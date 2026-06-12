import { BadRequestException } from '@nestjs/common';

export type RequestRecord = Record<string, unknown>;

export function parseRequestRecord(value: unknown): RequestRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as RequestRecord;
  }

  throw new BadRequestException('Corpo da requisição deve ser um objeto');
}

export function requiredString(
  source: RequestRecord,
  field: string,
  label: string,
): string {
  const value = source[field];

  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} é obrigatório`);
  }

  return value.trim();
}

export function optionalString(
  source: RequestRecord,
  field: string,
): string | null {
  const value = source[field];

  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} deve ser texto`);
  }

  return value.trim() || null;
}

export function requiredInteger(
  source: RequestRecord,
  field: string,
  label: string,
): number {
  const value = Number(source[field]);

  if (!Number.isInteger(value)) {
    throw new BadRequestException(`${label} deve ser um inteiro`);
  }

  return value;
}

export function optionalInteger(
  source: RequestRecord,
  field: string,
  label: string,
): number | undefined {
  const rawValue = source[field];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value)) {
    throw new BadRequestException(`${label} deve ser um inteiro`);
  }

  return value;
}

export function optionalBoolean(
  source: RequestRecord,
  field: string,
): boolean | null | undefined {
  const value = source[field];

  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new BadRequestException(`${field} deve ser verdadeiro ou falso`);
}

export function ensurePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${label} deve ser um inteiro positivo`);
  }

  return value;
}
