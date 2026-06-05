import { Injectable } from '@nestjs/common';
import {
  type NewSensor,
  type Sensor,
  type SensorWrite,
  SensorsRepository,
} from '@weber-nexus/repository';
import { PollingRuntimeService } from '../../polling/polling-runtime.service';

@Injectable()
export class SensorsService {
  constructor(
    private readonly sensorsRepository: SensorsRepository,
    private readonly pollingRuntimeService: PollingRuntimeService,
  ) {}

  getAllSensors(): Promise<Sensor[]> {
    return this.sensorsRepository.findAll();
  }

  getSensorById(id: number): Promise<Sensor> {
    return this.sensorsRepository.findById(id);
  }

  async postSensor(sensor: NewSensor): Promise<Sensor> {
    const insertedSensor = await this.sensorsRepository.insertSensor(sensor);

    void this.pollingRuntimeService.refreshController(
      insertedSensor.controllerId,
    );

    return insertedSensor;
  }

  updateSensor(sensor: SensorWrite): Promise<Sensor> {
    return this.sensorsRepository.updateSensor(sensor);
  }

  deleteSensor(sensorId: number) {
    return this.sensorsRepository.deleteSensor(sensorId);
  }
}
