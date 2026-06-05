import { Injectable } from '@nestjs/common';
import {
  ControllersRepository,
  SensorsRepository,
  type Controller,
  type ControllerWrite,
  type NewController,
} from '@weber-nexus/repository';

@Injectable()
export class ControllersService {
  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
  ) {}

  getAllControllers(): Promise<Controller[]> {
    return this.controllersRepository.findAll();
  }

  getControllerById(id: number): Promise<Controller> {
    return this.controllersRepository.findById(id);
  }

  postController(controller: NewController): Promise<Controller> {
    return this.controllersRepository.insertController(controller);
  }

  updateController(controller: ControllerWrite): Promise<Controller> {
    return this.controllersRepository.updateController(controller);
  }

  async deleteController(controllerId: number) {
    await this.sensorsRepository.deleteByControllerId(controllerId);
    return this.controllersRepository.deleteController(controllerId);
  }
}
