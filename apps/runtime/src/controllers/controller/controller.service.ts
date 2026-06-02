import { Injectable } from '@nestjs/common';
import {
  ControllersRepository,
  type Controller,
} from '@weber-nexus/repository';

@Injectable()
export class ControllersService {
  constructor(private readonly controllersRepository: ControllersRepository) {}

  getAllControllers(): Promise<Controller[]> {
    return this.controllersRepository.findAll();
  }

  getControllerById(id: number): Promise<Controller> {
    return this.controllersRepository.findById(id);
  }

  postController(controller: Omit<Controller, 'id'>): Promise<Controller> {
    return this.controllersRepository.insertController(controller);
  }

  updateController(controller: Controller): Promise<Controller> {
    return this.controllersRepository.updateController(controller);
  }

  deleteController(controllerId: number) {
    return this.controllersRepository.deleteController(controllerId);
  }
}
