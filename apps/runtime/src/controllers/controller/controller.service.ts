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

@Injectable()
export class ControllersService {
  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly pollingRuntimeService: PollingRuntimeService,
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

  postController(controller: NewController): Promise<Controller> {
    this.validatePollingInterval(controller.pollingIntervalMs);

    return this.controllersRepository.insertController(controller);
  }

  async updateController(controller: ControllerWrite): Promise<Controller> {
    this.validatePollingInterval(controller.pollingIntervalMs);

    const updatedController =
      await this.controllersRepository.updateController(controller);

    void this.pollingRuntimeService.refreshController(updatedController.id);

    return updatedController;
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
