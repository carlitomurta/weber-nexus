import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ControllersRepository,
  SensorsRepository,
  type Controller,
  type ControllerWrite,
  type NewController,
} from '@weber-nexus/repository';
import { PollingRuntimeService } from '../../polling/polling-runtime.service';
import { ControllerXmlConfigService } from '../xml/controller-xml-config.service';

@Injectable()
export class ControllersService {
  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly pollingRuntimeService: PollingRuntimeService,
    private readonly controllerXmlConfigService: ControllerXmlConfigService,
  ) {}

  getAllControllers(): Promise<Controller[]> {
    return this.controllersRepository.findAll();
  }

  async getControllerById(id: number): Promise<Controller> {
    const controller = await this.controllersRepository.findById(id);

    if (!controller) {
      throw new NotFoundException(`Controller ${id} was not found`);
    }

    return controller;
  }

  async postController(controller: NewController): Promise<Controller> {
    this.validatePollingInterval(controller.pollingIntervalMs);

    const parsedXml =
      await this.controllerXmlConfigService.downloadControllerConfig(
        controller.ipAddress,
      );
    const newController =
      await this.controllersRepository.insertControllerWithSensors(
        controller,
        parsedXml.sensors,
        this.controllerXmlConfigService.toXmlMetadata(parsedXml),
      );

    void this.pollingRuntimeService.refreshController(newController.id);

    return newController;
  }

  async updateController(controller: ControllerWrite): Promise<Controller> {
    if (!Number.isInteger(controller.id)) {
      throw new BadRequestException('Controller ID is required');
    }

    this.validatePollingInterval(controller.pollingIntervalMs);

    const currentController = await this.getControllerById(controller.id);
    const currentSensors = await this.sensorsRepository.findByControllerId(
      controller.id,
    );
    const controllerForUpload = {
      ...currentController,
      ...controller,
      name: controller.name.trim(),
      model: controller.model.trim(),
      ipAddress: controller.ipAddress.trim(),
      site: controller.site?.trim() || null,
    };
    const xmlMetadata =
      await this.controllerXmlConfigService.uploadControllerConfig(
        controllerForUpload,
        currentSensors,
      );
    const updatedController =
      await this.controllersRepository.updateController({
        ...controllerForUpload,
        ...xmlMetadata,
      });

    void this.pollingRuntimeService.refreshController(updatedController.id);

    return updatedController;
  }

  async syncControllerXml(controllerId: number) {
    const result =
      await this.controllerXmlConfigService.syncController(controllerId);

    void this.pollingRuntimeService.refreshController(controllerId);

    return result;
  }

  async deleteController(controllerId: number) {
    const controller =
      await this.controllersRepository.deleteController(controllerId);

    if (!controller) {
      throw new NotFoundException(`Controller ${controllerId} was not found`);
    }

    await this.sensorsRepository.deleteByControllerId(controllerId);
    this.pollingRuntimeService.stopController(controllerId);

    return controller;
  }

  private validatePollingInterval(pollingIntervalMs?: number | null): void {
    if (
      pollingIntervalMs !== undefined &&
      pollingIntervalMs !== null &&
      (!Number.isInteger(pollingIntervalMs) || pollingIntervalMs <= 0)
    ) {
      throw new BadRequestException(
        'Polling interval must be a positive integer in milliseconds',
      );
    }
  }
}
