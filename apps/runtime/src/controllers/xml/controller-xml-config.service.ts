import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import {
  ControllersRepository,
  SensorsRepository,
  type Controller,
  type NewSensor,
  type Sensor,
} from '@weber-nexus/repository';
import {
  createWlConfigUploadPlan,
  downloadWlConfigXml,
  readControllerLocalRegister,
  resetController,
  uploadWlConfigXml,
} from './controller-file-transfer';
import {
  buildWlConfigXml,
  cleanWlConfigXml,
  hasReusableWlConfigFileInfo,
  parseWlConfigXml,
  type ParsedWlConfig,
} from './wlconfig-xml';

export type ControllerXmlSyncResult = {
  readonly status: 'synced' | 'unchanged';
  readonly sensorsImported: number;
};

const READ_MAP_SUCCESS_REGISTER = 10101;
const UPLOAD_VERIFY_INITIAL_DELAY_MS = 5000;
const UPLOAD_VERIFY_RETRY_DELAY_MS = 5000;
const UPLOAD_VERIFY_MAX_ATTEMPTS = 18;

@Injectable()
export class ControllerXmlConfigService {
  private readonly logger = new Logger(
    'runtime/controllers/xml/controller-xml-config.service.ts',
  );

  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
  ) {}

  async downloadControllerConfig(ipAddress: string): Promise<ParsedWlConfig> {
    try {
      const rawXml = await downloadWlConfigXml({ host: ipAddress });
      const cleanedXml = cleanWlConfigXml(rawXml);
      const parsed = parseWlConfigXml(cleanedXml);

      this.logger.info(
        `WLConfig.xml baixado de ${ipAddress}: checksum=${parsed.checksum} bytes=${Buffer.byteLength(parsed.xml, 'utf8')} sensores=${parsed.sensors.length}`,
      );

      return parsed;
    } catch (error) {
      this.logger.error(`Falha ao baixar WLConfig.xml de ${ipAddress}`, error);
      throw new BadGatewayException(
        'Não foi possível baixar um WLConfig.xml válido',
      );
    }
  }

  async syncController(controllerId: number): Promise<ControllerXmlSyncResult> {
    const controller = await this.controllersRepository.findById(controllerId);

    if (!controller) {
      throw new NotFoundException(
        `Controlador ${controllerId} não foi encontrado`,
      );
    }

    const parsed = await this.downloadControllerConfig(controller.ipAddress);

    if (parsed.checksum === controller.xmlConfigChecksum) {
      return {
        status: 'unchanged',
        sensorsImported: 0,
      };
    }

    await this.sensorsRepository.replaceByControllerIdWithXmlMetadata(
      controller.id,
      parsed.sensors.map((sensor) => ({
        ...sensor,
        controllerId: controller.id,
      })),
      this.toXmlMetadata(parsed),
    );

    return {
      status: 'synced',
      sensorsImported: parsed.sensors.length,
    };
  }

  async uploadControllerConfig(
    controller: Pick<Controller, 'ipAddress' | 'xmlConfig'>,
    sensors: ReadonlyArray<Sensor | NewSensor>,
  ): Promise<{
    xmlConfig: string;
    xmlConfigChecksum: string;
    xmlLastSyncedAt: Date;
  }> {
    const baseXml = await this.resolveBaseXmlForUpload(controller);
    const xmlConfig = buildWlConfigXml(baseXml, sensors);
    const uploadPlan = createWlConfigUploadPlan(xmlConfig.xml);

    this.logger.info(
      `Enviando WLConfig.xml para ${controller.ipAddress}: checksum=${xmlConfig.checksum} fileSizeBytes=${uploadPlan.fileSizeBytes} totalChunkBytes=${uploadPlan.totalChunkBytes} chunkCount=${uploadPlan.chunkCount} chunkSizes=${uploadPlan.chunkSizes.join(',')}`,
    );

    try {
      await uploadWlConfigXml(xmlConfig.xml, { host: controller.ipAddress });
      this.logger.info(
        `WLConfig.xml enviado para ${controller.ipAddress}: checksum=${xmlConfig.checksum}`,
      );
      await resetController({ host: controller.ipAddress });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar WLConfig.xml para ${controller.ipAddress}`,
        error,
      );
      throw new BadGatewayException('Não foi possível enviar o WLConfig.xml');
    }

    this.scheduleUploadVerification(controller.ipAddress);

    return {
      xmlConfig: xmlConfig.xml,
      xmlConfigChecksum: xmlConfig.checksum,
      xmlLastSyncedAt: new Date(),
    };
  }

  private async resolveBaseXmlForUpload(
    controller: Pick<Controller, 'ipAddress' | 'xmlConfig'>,
  ): Promise<string | null | undefined> {
    if (hasReusableWlConfigFileInfo(controller.xmlConfig)) {
      return controller.xmlConfig;
    }

    try {
      const parsed = await this.downloadControllerConfig(controller.ipAddress);

      return parsed.xml;
    } catch (error) {
      this.logger.warn(
        `Não foi possível reaproveitar os metadados XML de ${controller.ipAddress}`,
        error,
      );

      return controller.xmlConfig;
    }
  }

  private scheduleUploadVerification(ipAddress: string): void {
    void this.verifyUploadAfterRestart(ipAddress);
  }

  private async verifyUploadAfterRestart(ipAddress: string): Promise<void> {
    await sleep(UPLOAD_VERIFY_INITIAL_DELAY_MS);

    let lastError: unknown;

    for (let attempt = 1; attempt <= UPLOAD_VERIFY_MAX_ATTEMPTS; attempt += 1) {
      try {
        const value = await readControllerLocalRegister(
          READ_MAP_SUCCESS_REGISTER,
          {
            host: ipAddress,
            timeoutMs: 5000,
          },
        );

        this.logger.info(
          `Registrador virtual ${READ_MAP_SUCCESS_REGISTER} após envio do WLConfig.xml para ${ipAddress}: ${value} sucessos acumulados`,
        );
        return;
      } catch (error) {
        lastError = error;

        if (attempt < UPLOAD_VERIFY_MAX_ATTEMPTS) {
          await sleep(UPLOAD_VERIFY_RETRY_DELAY_MS);
        }
      }
    }

    this.logger.warn(
      `Não foi possível ler o registrador virtual ${READ_MAP_SUCCESS_REGISTER} após envio do WLConfig.xml para ${ipAddress}`,
      lastError,
    );
  }

  toXmlMetadata(parsed: ParsedWlConfig): {
    xmlConfig: string;
    xmlConfigChecksum: string;
    xmlLastSyncedAt: Date;
  } {
    if (parsed.sensors.some((sensor) => sensor.registers.length === 0)) {
      throw new BadRequestException(
        'Sensores importados devem conter registros',
      );
    }

    return {
      xmlConfig: parsed.xml,
      xmlConfigChecksum: parsed.checksum,
      xmlLastSyncedAt: new Date(),
    };
  }
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
