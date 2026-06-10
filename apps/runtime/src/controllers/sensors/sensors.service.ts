import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ControllersRepository,
  type NewSensor,
  type Sensor,
  type SensorWrite,
  SensorsRepository,
} from '@weber-nexus/repository';
import { PollingRuntimeService } from '../../polling/polling-runtime.service';
import { ControllerXmlConfigService } from '../xml/controller-xml-config.service';

@Injectable()
export class SensorsService {
  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly pollingRuntimeService: PollingRuntimeService,
    private readonly controllerXmlConfigService: ControllerXmlConfigService,
  ) {}

  getAllSensors(): Promise<Sensor[]> {
    return this.sensorsRepository.findAll();
  }

  async getSensorById(id: number): Promise<Sensor> {
    const sensor = await this.sensorsRepository.findById(id);

    if (!sensor) {
      throw new NotFoundException(`Sensor ${id} não foi encontrado`);
    }

    return sensor;
  }

  async postSensor(sensor: NewSensor): Promise<Sensor> {
    await this.validateSensorConfiguration(sensor);
    const controller = await this.getControllerForSensor(sensor.controllerId);
    const currentSensors = await this.sensorsRepository.findByControllerId(
      sensor.controllerId,
    );
    const xmlMetadata =
      await this.controllerXmlConfigService.uploadControllerConfig(controller, [
        ...currentSensors,
        sensor,
      ]);

    const insertedSensor = await this.sensorsRepository.insertSensor(sensor);
    await this.controllersRepository.updateXmlSyncMetadata(
      insertedSensor.controllerId,
      xmlMetadata,
    );

    void this.pollingRuntimeService.refreshController(
      insertedSensor.controllerId,
    );

    return insertedSensor;
  }

  async updateSensor(sensor: SensorWrite): Promise<Sensor> {
    const currentSensor = await this.getSensorById(sensor.id);

    if (sensor.controllerId !== currentSensor.controllerId) {
      throw new BadRequestException(
        'Não é possível mover sensores entre controladores',
      );
    }

    await this.validateSensorConfiguration(sensor, sensor.id);
    const controller = await this.getControllerForSensor(sensor.controllerId);
    const currentSensors = await this.sensorsRepository.findByControllerId(
      sensor.controllerId,
    );
    const nextSensors = currentSensors.map((item) =>
      item.id === sensor.id ? { ...item, ...sensor } : item,
    );
    const xmlMetadata =
      await this.controllerXmlConfigService.uploadControllerConfig(
        controller,
        nextSensors,
      );

    const updatedSensor = await this.sensorsRepository.updateSensor(sensor);
    await this.controllersRepository.updateXmlSyncMetadata(
      updatedSensor.controllerId,
      xmlMetadata,
    );

    void this.pollingRuntimeService.refreshController(
      updatedSensor.controllerId,
    );

    return updatedSensor;
  }

  async deleteSensor(sensorId: number) {
    const currentSensor = await this.getSensorById(sensorId);
    const controller = await this.getControllerForSensor(
      currentSensor.controllerId,
    );
    const currentSensors = await this.sensorsRepository.findByControllerId(
      currentSensor.controllerId,
    );
    const nextSensors = currentSensors.filter(
      (sensor) => sensor.id !== sensorId,
    );
    const xmlMetadata =
      await this.controllerXmlConfigService.uploadControllerConfig(
        controller,
        nextSensors,
      );
    const deletedSensor = await this.sensorsRepository.deleteSensor(sensorId);

    if (!deletedSensor) {
      throw new NotFoundException(`Sensor ${sensorId} não foi encontrado`);
    }

    await this.controllersRepository.updateXmlSyncMetadata(
      deletedSensor.controllerId,
      xmlMetadata,
    );

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
      throw new BadRequestException('ID do nó deve ser um inteiro de 1 a 247');
    }

    if (!Array.isArray(sensor.registers) || sensor.registers.length === 0) {
      throw new BadRequestException(
        'Registros do sensor não podem ficar vazios',
      );
    }

    const invalidRegister = sensor.registers.find(
      (register) =>
        !register.name?.trim() ||
        !Number.isInteger(register.address) ||
        register.address < firstNodeRegisterAddress(sensor.nodeId) ||
        register.address > lastNodeRegisterAddress(sensor.nodeId) ||
        this.isInvalidRegisterScale(register) ||
        (!register.isHealthCheck && !register.unit?.trim()),
    );

    if (invalidRegister !== undefined) {
      throw new BadRequestException(
        `Registros do sensor devem ter nome e endereços entre ${firstNodeRegisterAddress(sensor.nodeId)} e ${lastNodeRegisterAddress(sensor.nodeId)}`,
      );
    }

    const conflict = await this.sensorsRepository.findConflictingNodeId(
      sensor.controllerId,
      sensor.nodeId,
      sensorId,
    );

    if (conflict) {
      throw new BadRequestException(
        `ID do nó ${sensor.nodeId} já está cadastrado no controlador ${sensor.controllerId}`,
      );
    }
  }

  private isInvalidRegisterScale(
    register: NewSensor['registers'][number],
  ): boolean {
    if (register.isHealthCheck) return false;
    if (
      register.scaleType === undefined &&
      register.scaleFactor === undefined
    ) {
      return false;
    }

    return (
      register.scaleType === undefined ||
      !['multiply', 'divide'].includes(register.scaleType) ||
      register.scaleFactor === undefined ||
      !Number.isFinite(register.scaleFactor) ||
      register.scaleFactor <= 0
    );
  }

  private async getControllerForSensor(controllerId: number) {
    const controller = await this.controllersRepository.findById(controllerId);

    if (!controller) {
      throw new NotFoundException(
        `Controlador ${controllerId} não foi encontrado`,
      );
    }

    return controller;
  }
}

function firstNodeRegisterAddress(nodeId: number): number {
  return nodeId * 16 + 1;
}

function lastNodeRegisterAddress(nodeId: number): number {
  return nodeId * 16 + 16;
}
