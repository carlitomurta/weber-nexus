import { BadRequestException } from '@nestjs/common';
import type {
  NewEquipment,
  NewSensorInstallation,
  EquipmentWrite,
} from '@weber-nexus/repository';
import {
  ensurePositiveInteger,
  optionalString,
  parseRequestRecord,
  requiredInteger,
  requiredString,
} from '../../common/request-validation';

export type CreateEquipmentDto = NewEquipment;
export type UpdateEquipmentDto = EquipmentWrite;
export type CreateSensorInstallationDto = NewSensorInstallation;

export function parseCreateEquipmentDto(value: unknown): CreateEquipmentDto {
  const body = parseRequestRecord(value);

  return {
    equipmentTypeId: ensurePositiveInteger(
      requiredInteger(body, 'equipmentTypeId', 'Tipo do equipamento'),
      'Tipo do equipamento',
    ),
    name: requiredString(body, 'name', 'Nome'),
    tag: requiredString(body, 'tag', 'Tag'),
    manufacturer: optionalString(body, 'manufacturer'),
    model: optionalString(body, 'model'),
    serialNumber: optionalString(body, 'serialNumber'),
    site: optionalString(body, 'site'),
    area: optionalString(body, 'area'),
    location: optionalString(body, 'location'),
    criticality: readTextWithDefault(body, 'criticality', 'medium'),
    operationalStatus: readTextWithDefault(body, 'operationalStatus', 'active'),
    specificAttributes: parseSpecificAttributes(body.specificAttributes),
    deletedAt: null,
  };
}

export function parseUpdateEquipmentDto(value: unknown): UpdateEquipmentDto {
  const body = parseRequestRecord(value);

  return {
    id: ensurePositiveInteger(
      requiredInteger(body, 'id', 'ID do equipamento'),
      'ID do equipamento',
    ),
    ...parseCreateEquipmentDto(body),
  };
}

export function parseCreateSensorInstallationDto(
  value: unknown,
  equipmentId: number,
): CreateSensorInstallationDto {
  const body = parseRequestRecord(value);

  return {
    equipmentId,
    sensorId: ensurePositiveInteger(
      requiredInteger(body, 'sensorId', 'Sensor'),
      'Sensor',
    ),
    installedAt: readDateWithDefault(body.installedAt),
    endedAt: null,
    position: optionalString(body, 'position'),
    measurementAxis: optionalString(body, 'measurementAxis'),
    notes: optionalString(body, 'notes'),
  };
}

export function parseEndSensorInstallationDto(value: unknown): Date {
  const body = parseRequestRecord(value);
  return readDateWithDefault(body.endedAt);
}

function readTextWithDefault(
  body: Record<string, unknown>,
  field: string,
  fallback: string,
): string {
  const value = body[field];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} deve ser texto`);
  }

  return value.trim() || fallback;
}

function parseSpecificAttributes(value: unknown): NewEquipment['specificAttributes'] {
  if (value === undefined || value === null) return {};

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Atributos específicos devem ser um objeto');
  }

  return value as NewEquipment['specificAttributes'];
}

function readDateWithDefault(value: unknown): Date {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Data deve ser texto em ISO-8601');
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Data inválida');
  }

  return date;
}
