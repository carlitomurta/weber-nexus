import { BadRequestException } from '@nestjs/common';
import type { NewSensor, Sensor, SensorWrite } from '@weber-nexus/repository';
import {
  ensurePositiveInteger,
  optionalString,
  parseRequestRecord,
  requiredInteger,
  requiredString,
  type RequestRecord,
} from '../../../common/request-validation';

export type CreateSensorDto = NewSensor;
export type UpdateSensorDto = SensorWrite;
type SensorRegister = Sensor['registers'][number];

export function parseCreateSensorDto(value: unknown): CreateSensorDto {
  const body = parseRequestRecord(value);

  return {
    controllerId: ensurePositiveInteger(
      requiredInteger(body, 'controllerId', 'ID do controlador'),
      'ID do controlador',
    ),
    nodeId: ensurePositiveInteger(
      requiredInteger(body, 'nodeId', 'ID do sensor'),
      'ID do sensor',
    ),
    name: requiredString(body, 'name', 'Nome'),
    description: optionalString(body, 'description'),
    model: optionalString(body, 'model'),
    location: optionalString(body, 'location'),
    operationalStatus: readOperationalStatus(body),
    registers: parseSensorRegisters(body.registers),
    deletedAt: null,
  };
}

export function parseUpdateSensorDto(value: unknown): UpdateSensorDto {
  const body = parseRequestRecord(value);

  return {
    id: ensurePositiveInteger(
      requiredInteger(body, 'id', 'ID do sensor'),
      'ID do sensor',
    ),
    ...parseCreateSensorDto(body),
  };
}

function readOperationalStatus(body: RequestRecord): string {
  const value = body.operationalStatus;

  if (value === undefined || value === null || value === '') {
    return 'active';
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Status operacional deve ser texto');
  }

  return value.trim() || 'active';
}

function parseSensorRegisters(value: unknown): SensorRegister[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Registros do sensor devem ser uma lista');
  }

  return value.map(parseSensorRegister);
}

function parseSensorRegister(value: unknown): SensorRegister {
  const register = parseRequestRecord(value);
  const scaleType = parseScaleType(register.scaleType);
  const isHealthCheck =
    typeof register.isHealthCheck === 'boolean'
      ? register.isHealthCheck
      : undefined;
  const scaleFactor =
    register.scaleFactor === undefined || register.scaleFactor === null
      ? undefined
      : Number(register.scaleFactor);
  const localRegisterNumber =
    register.localRegisterNumber === undefined ||
    register.localRegisterNumber === null
      ? undefined
      : ensurePositiveInteger(
          Number(register.localRegisterNumber),
          'Registrador local',
        );

  if (
    scaleFactor !== undefined &&
    (!Number.isFinite(scaleFactor) || scaleFactor <= 0)
  ) {
    throw new BadRequestException('Fator de escala deve ser positivo');
  }

  return {
    name: requiredString(register, 'name', 'Nome do registro'),
    address: requiredInteger(register, 'address', 'Endereço do registro'),
    scaleType,
    scaleFactor,
    unit: optionalString(register, 'unit') ?? '',
    isHealthCheck,
    localRegisterNumber,
  };
}

function parseScaleType(value: unknown): SensorRegister['scaleType'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'multiply' || value === 'divide') return value;

  throw new BadRequestException('Tipo de escala deve ser multiply ou divide');
}
