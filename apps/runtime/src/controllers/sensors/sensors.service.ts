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
      !Number.isInteger(sensor.modbusId) ||
      sensor.modbusId < 1 ||
      sensor.modbusId > 247
    ) {
      throw new BadRequestException(
        'Modbus ID must be an integer from 1 to 247',
      );
    }

    if (!Array.isArray(sensor.registers) || sensor.registers.length === 0) {
      throw new BadRequestException('Sensor registers must not be empty');
    }

    const invalidRegister = sensor.registers.find(
      (register) =>
        !Number.isInteger(register) || register < 0 || register > 65535,
    );

    if (invalidRegister !== undefined) {
      throw new BadRequestException(
        'Sensor registers must be integers from 0 to 65535',
      );
    }

    const conflict = await this.sensorsRepository.findConflictingModbusId(
      sensor.controllerId,
      sensor.modbusId,
      sensorId,
    );

    if (conflict) {
      throw new BadRequestException(
        `Modbus ID ${sensor.modbusId} is already registered on controller ${sensor.controllerId}`,
      );
    }
  }
}
