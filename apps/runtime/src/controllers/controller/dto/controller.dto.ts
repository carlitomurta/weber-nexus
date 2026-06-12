import type { NewController } from '@weber-nexus/repository';
import {
  ensurePositiveInteger,
  optionalBoolean,
  optionalInteger,
  optionalString,
  parseRequestRecord,
  requiredInteger,
  requiredString,
} from '../../../common/request-validation';

export type CreateControllerDto = NewController;

export type UpdateControllerDto = CreateControllerDto & {
  readonly id: number;
};

export function parseCreateControllerDto(value: unknown): CreateControllerDto {
  const body = parseRequestRecord(value);
  const pollingIntervalMs = optionalInteger(
    body,
    'pollingIntervalMs',
    'Intervalo de coleta',
  );
  const port = optionalInteger(body, 'port', 'Porta');

  return {
    name: requiredString(body, 'name', 'Nome'),
    model: requiredString(body, 'model', 'Modelo'),
    ipAddress: requiredString(body, 'ipAddress', 'Endereço IP'),
    site: optionalString(body, 'site'),
    port: port ?? 0,
    isMultihop: optionalBoolean(body, 'isMultihop') ?? false,
    pollingIntervalMs:
      pollingIntervalMs === undefined
        ? 300000
        : ensurePositiveInteger(pollingIntervalMs, 'Intervalo de coleta'),
  };
}

export function parseUpdateControllerDto(value: unknown): UpdateControllerDto {
  const body = parseRequestRecord(value);

  return {
    id: requiredInteger(body, 'id', 'ID do controlador'),
    ...parseCreateControllerDto(body),
  };
}
