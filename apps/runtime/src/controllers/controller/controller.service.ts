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
      throw new NotFoundException(`Controlador ${id} não foi encontrado`);
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
      throw new BadRequestException('ID do controlador é obrigatório');
    }

    this.validatePollingInterval(controller.pollingIntervalMs);

    const currentController = await this.getControllerById(controller.id);
    const controllerForUpload = {
      ...currentController,
      ...controller,
      name: controller.name.trim(),
      model: controller.model.trim(),
      ipAddress: controller.ipAddress.trim(),
      site: controller.site?.trim() || null,
    };
    const updatedController = await this.updateControllerAndXmlIfIpChanged(
      currentController,
      controllerForUpload,
    );

    void this.pollingRuntimeService.refreshController(updatedController.id);

    return updatedController;
  }

  private async updateControllerAndXmlIfIpChanged(
    currentController: Controller,
    nextController: ControllerWrite,
  ): Promise<Controller> {
    if (currentController.ipAddress === nextController.ipAddress) {
      return this.controllersRepository.updateController(nextController);
    }

    const parsedXml =
      await this.controllerXmlConfigService.downloadControllerConfig(
        nextController.ipAddress,
      );
    return this.controllersRepository.updateControllerWithSensors(
      {
        ...nextController,
        ...this.controllerXmlConfigService.toXmlMetadata(parsedXml),
      },
      parsedXml.sensors,
    );
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
      throw new NotFoundException(
        `Controlador ${controllerId} não foi encontrado`,
      );
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
        'Intervalo de coleta deve ser um inteiro positivo em milissegundos',
      );
    }
  }
}
