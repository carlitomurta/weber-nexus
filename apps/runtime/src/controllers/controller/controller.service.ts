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
}
