import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async getSensorById(id: number): Promise<Sensor> {
    const sensor = await this.sensorsRepository.findById(id);

    if (!sensor) {
      throw new NotFoundException(`Sensor ${id} was not found`);
    }

    return sensor;
  }

  async postSensor(sensor: NewSensor): Promise<Sensor> {
    await this.validateSensorConfiguration(sensor);

    const insertedSensor = await this.sensorsRepository.insertSensor(sensor);

    void this.pollingRuntimeService.refreshController(
      insertedSensor.controllerId,
    );

    return insertedSensor;
  }

  async updateSensor(sensor: SensorWrite): Promise<Sensor> {
    await this.validateSensorConfiguration(sensor, sensor.id);

    const updatedSensor = await this.sensorsRepository.updateSensor(sensor);

    void this.pollingRuntimeService.refreshController(
      updatedSensor.controllerId,
    );

    return updatedSensor;
  }

  async deleteSensor(sensorId: number) {
    const deletedSensor = await this.sensorsRepository.deleteSensor(sensorId);

    if (!deletedSensor) {
      throw new NotFoundException(`Sensor ${sensorId} was not found`);
    }

    void this.pollingRuntimeService.refreshController(
      deletedSensor.controllerId,
    );

    return deletedSensor;
  }

  private async validateSensorConfiguration(
    sensor: NewSensor | SensorWrite,
    sensorId?: number,
  ): Promise<void> {
    if (
      !Number.isInteger(sensor.nodeId) ||
      sensor.nodeId < 1 ||
      sensor.nodeId > 247
    ) {
      throw new BadRequestException('Node ID must be an integer from 1 to 247');
    }

    if (!Array.isArray(sensor.registers) || sensor.registers.length === 0) {
      throw new BadRequestException('Sensor registers must not be empty');
    }

    const invalidRegister = sensor.registers.find(
      (register) =>
        !register.name?.trim() ||
        !Number.isInteger(register.address) ||
        register.address < firstNodeRegisterAddress(sensor.nodeId) ||
        register.address > lastNodeRegisterAddress(sensor.nodeId) ||
        !['multiply', 'divide'].includes(register.scaleType) ||
        !Number.isFinite(register.scaleFactor) ||
        register.scaleFactor <= 0 ||
        !register.unit?.trim(),
    );

    if (invalidRegister !== undefined) {
      throw new BadRequestException(
        `Sensor registers must be named, scaled addresses from ${firstNodeRegisterAddress(sensor.nodeId)} to ${lastNodeRegisterAddress(sensor.nodeId)}`,
      );
    }

    const conflict = await this.sensorsRepository.findConflictingNodeId(
      sensor.controllerId,
      sensor.nodeId,
      sensorId,
    );

    if (conflict) {
      throw new BadRequestException(
        `Node ID ${sensor.nodeId} is already registered on controller ${sensor.controllerId}`,
      );
    }
  }
}

function firstNodeRegisterAddress(nodeId: number): number {
  return nodeId * 16 + 1;
}

function lastNodeRegisterAddress(nodeId: number): number {
  return nodeId * 16 + 16;
}
