import { ATTRIBUTE_PREFIX, type WlConfigDocument } from './wlconfig-xml.types';

export function readStringAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = source?.[`${ATTRIBUTE_PREFIX}${name}`];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

export function readPositiveIntegerAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): number | undefined {
  const value = Number(readStringAttribute(source, name));

  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return undefined;
}

export function readPositiveNumberAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): number | undefined {
  const value = Number(readStringAttribute(source, name));

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return undefined;
}

export function readScaleType(
  source: Record<string, unknown> | undefined,
): 'multiply' | 'divide' | undefined {
  const value = readStringAttribute(source, 'scale_type');

  if (value === 'multiply' || value === 'divide') {
    return value;
  }

  return undefined;
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function isWlConfigDocument(value: unknown): value is WlConfigDocument {
  return isRecord(value) && isRecord(value.configuration);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
