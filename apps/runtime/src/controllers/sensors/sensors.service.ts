import { Injectable } from '@nestjs/common';
import { type Sensor, SensorsRepository } from '@weber-nexus/repository';

@Injectable()
export class SensorsService {
  constructor(private readonly sensorsRepository: SensorsRepository) {}

  getAllSensors(): Promise<Sensor[]> {
    return this.sensorsRepository.findAll();
  }

  getSensorById(id: number): Promise<Sensor> {
    return this.sensorsRepository.findById(id);
  }
}
