import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import {
  ControllersRepository,
  SensorsRepository,
  type Controller,
  type NewSensor,
  type Sensor,
  type SensorWrite,
} from '@weber-nexus/repository';
import { PollingRuntimeService } from '../../polling/polling-runtime.service';
import { ControllerXmlConfigService } from '../xml/controller-xml-config.service';

@Injectable()
export class SensorsService {
  private readonly logger = new Logger(
    'runtime/controllers/sensors/sensors.service.ts',
  );

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
    const controller = await this.getControllerForSensor(sensor.controllerId);
    const currentSensors = await this.sensorsRepository.findByControllerId(
      sensor.controllerId,
    );
    this.validateSensorConfiguration(sensor, currentSensors);
    const xmlMetadata = await this.uploadControllerConfigOrThrow(
      controller,
      [...currentSensors, sensor],
      `criar sensor ${sensor.name}`,
    );

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

    if (!this.hasSensorXmlChanges(currentSensor, sensor)) {
      return this.sensorsRepository.updateSensor(sensor);
    }

    const controller = await this.getControllerForSensor(sensor.controllerId);
    const currentSensors = await this.sensorsRepository.findByControllerId(
      sensor.controllerId,
    );
    this.validateSensorConfiguration(sensor, currentSensors, sensor.id);
    const nextSensors = currentSensors.map((item) =>
      item.id === sensor.id ? { ...item, ...sensor } : item,
    );
    const xmlMetadata = await this.uploadControllerConfigOrThrow(
      controller,
      nextSensors,
      `atualizar sensor ${sensor.id}`,
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
    const xmlMetadata = await this.uploadControllerConfigOrThrow(
      controller,
      nextSensors,
      `remover sensor ${sensorId}`,
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

  private validateSensorConfiguration(
    sensor: NewSensor | SensorWrite,
    currentSensors: ReadonlyArray<Sensor>,
    sensorId?: number,
  ): void {
    if (
      !Number.isInteger(sensor.nodeId) ||
      sensor.nodeId < 1 ||
      sensor.nodeId > 247
    ) {
      throw new BadRequestException(
        'ID do sensor deve ser um inteiro de 1 a 247',
      );
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
        (register.localRegisterNumber !== undefined &&
          (!Number.isInteger(register.localRegisterNumber) ||
            register.localRegisterNumber <= 0)) ||
        this.isInvalidRegisterScale(register),
    );

    if (invalidRegister !== undefined) {
      throw new BadRequestException(
        `Registros do nó ${sensor.nodeId} devem ter nome e endereços entre ${firstNodeRegisterAddress(sensor.nodeId)} e ${lastNodeRegisterAddress(sensor.nodeId)}`,
      );
    }

    const conflictAddress = this.findConflictingRegisterAddress(
      sensor,
      currentSensors,
      sensorId,
    );

    if (conflictAddress !== undefined) {
      throw new BadRequestException(
        `Endereço de registrador ${conflictAddress} já está cadastrado no controlador ${sensor.controllerId}`,
      );
    }

    const duplicatedStatusNodeId = this.findDuplicatedStatusNodeId(
      sensor,
      currentSensors,
      sensorId,
    );

    if (duplicatedStatusNodeId !== undefined) {
      throw new BadRequestException(
        `Nó ${duplicatedStatusNodeId} deve ter apenas um registrador de status`,
      );
    }
  }

  private findConflictingRegisterAddress(
    sensor: NewSensor | SensorWrite,
    currentSensors: ReadonlyArray<Sensor>,
    sensorId?: number,
  ): number | undefined {
    const nextAddresses = new Set(
      sensor.registers.map((register) => register.address),
    );

    for (const currentSensor of currentSensors) {
      if (sensorId !== undefined && currentSensor.id === sensorId) {
        continue;
      }

      for (const register of currentSensor.registers) {
        if (nextAddresses.has(register.address)) {
          return register.address;
        }
      }
    }

    return undefined;
  }

  private findDuplicatedStatusNodeId(
    sensor: NewSensor | SensorWrite,
    currentSensors: ReadonlyArray<Sensor>,
    sensorId?: number,
  ): number | undefined {
    const statusCountsByNodeId = new Map<number, number>();
    const nextSensors = [
      ...currentSensors.filter(
        (currentSensor) =>
          sensorId === undefined || currentSensor.id !== sensorId,
      ),
      sensor,
    ];

    for (const item of nextSensors) {
      const statusCount = item.registers.filter(
        (register) => register.isHealthCheck === true,
      ).length;

      if (statusCount === 0) continue;

      const nextCount =
        (statusCountsByNodeId.get(item.nodeId) ?? 0) + statusCount;

      if (nextCount > 1) return item.nodeId;

      statusCountsByNodeId.set(item.nodeId, nextCount);
    }

    return undefined;
  }

  private hasSensorXmlChanges(
    currentSensor: Sensor,
    nextSensor: SensorWrite,
  ): boolean {
    if (currentSensor.nodeId !== nextSensor.nodeId) return true;
    if (currentSensor.name.trim() !== nextSensor.name.trim()) return true;

    return !this.areSensorRegistersXmlEqual(
      currentSensor.registers,
      nextSensor.registers,
    );
  }

  private areSensorRegistersXmlEqual(
    currentRegisters: Sensor['registers'],
    nextRegisters: SensorWrite['registers'],
  ): boolean {
    if (currentRegisters.length !== nextRegisters.length) return false;

    const current = [...currentRegisters].sort(compareRegistersForXml);
    const next = [...nextRegisters].sort(compareRegistersForXml);

    return current.every((register, index) =>
      areSensorRegisterXmlFieldsEqual(register, next[index]),
    );
  }

  private async uploadControllerConfigOrThrow(
    controller: Controller,
    sensors: ReadonlyArray<Sensor | NewSensor>,
    operation: string,
  ): ReturnType<ControllerXmlConfigService['uploadControllerConfig']> {
    try {
      return await this.controllerXmlConfigService.uploadControllerConfig(
        controller,
        sensors,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao enviar XML ao ${operation} no controlador ${controller.id} (${controller.ipAddress})`,
        error,
      );
      throw error;
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

function compareRegistersForXml(
  left: Sensor['registers'][number],
  right: Sensor['registers'][number],
): number {
  if (left.address !== right.address) return left.address - right.address;
  return left.name.localeCompare(right.name);
}

function areSensorRegisterXmlFieldsEqual(
  current: Sensor['registers'][number],
  next: SensorWrite['registers'][number] | undefined,
): boolean {
  if (next === undefined) return false;

  return (
    current.name.trim() === next.name.trim() &&
    current.address === next.address &&
    (current.scaleType ?? undefined) === (next.scaleType ?? undefined) &&
    (current.scaleFactor ?? undefined) === (next.scaleFactor ?? undefined) &&
    current.unit.trim() === next.unit.trim() &&
    (current.isHealthCheck ?? false) === (next.isHealthCheck ?? false)
  );
}
