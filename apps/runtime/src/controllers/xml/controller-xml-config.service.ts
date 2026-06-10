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
  uploadWlConfigXml,
} from './controller-file-transfer';
import {
  buildWlConfigXml,
  cleanWlConfigXml,
  parseWlConfigXml,
  type ParsedWlConfig,
} from './wlconfig-xml';

export type ControllerXmlSyncResult = {
  readonly status: 'synced' | 'unchanged';
  readonly sensorsImported: number;
};

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

      return parseWlConfigXml(cleanedXml);
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
    const xmlConfig = buildWlConfigXml(controller.xmlConfig, sensors);
    const uploadPlan = createWlConfigUploadPlan(xmlConfig.xml);

    this.logger.info(
      `Enviando WLConfig.xml para ${controller.ipAddress}: bytesDeclarados=${uploadPlan.fileSizeBytes} totalBytesFragmentos=${uploadPlan.totalChunkBytes} quantidadeFragmentos=${uploadPlan.chunkCount} tamanhosFragmentos=${uploadPlan.chunkSizes.join(',')}`,
    );

    try {
      await uploadWlConfigXml(xmlConfig.xml, { host: controller.ipAddress });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar WLConfig.xml para ${controller.ipAddress}`,
        error,
      );
      throw new BadGatewayException('Não foi possível enviar o WLConfig.xml');
    }

    return {
      xmlConfig: xmlConfig.xml,
      xmlConfigChecksum: xmlConfig.checksum,
      xmlLastSyncedAt: new Date(),
    };
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
