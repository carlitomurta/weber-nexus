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
      this.logger.error(`Failed to download WLConfig.xml from ${ipAddress}`, error);
      throw new BadGatewayException('Could not download a valid WLConfig.xml');
    }
  }

  async syncController(controllerId: number): Promise<ControllerXmlSyncResult> {
    const controller = await this.controllersRepository.findById(controllerId);

    if (!controller) {
      throw new NotFoundException(`Controller ${controllerId} was not found`);
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
  ): Promise<{ xmlConfig: string; xmlConfigChecksum: string; xmlLastSyncedAt: Date }> {
    const xmlConfig = buildWlConfigXml(controller.xmlConfig, sensors);

    try {
      await uploadWlConfigXml(xmlConfig.xml, { host: controller.ipAddress });
    } catch (error) {
      this.logger.error(
        `Failed to upload WLConfig.xml to ${controller.ipAddress}`,
        error,
      );
      throw new BadGatewayException('Could not upload WLConfig.xml');
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
      throw new BadRequestException('Imported sensors must include registers');
    }

    return {
      xmlConfig: parsed.xml,
      xmlConfigChecksum: parsed.checksum,
      xmlLastSyncedAt: new Date(),
    };
  }
}
