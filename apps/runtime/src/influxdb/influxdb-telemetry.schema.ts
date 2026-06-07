import type { ControllerPollingResult } from '@weber-nexus/polling-engine';

export const SENSOR_READINGS_MEASUREMENT = 'sensor_readings';

export type SensorReadingRegisterKind = 'metric' | 'health';
export type HealthStatusText = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

type LineField = string | number | boolean | IntegerLineField;
type IntegerLineField = {
  kind: 'integer';
  value: number;
};

export function buildSensorReadingsLineProtocol(
  result: ControllerPollingResult,
): string {
  const timestamp = toUnixNanoseconds(result.polledAt);
  const lines: string[] = [];

  for (const sensorResult of result.results) {
    for (const reading of sensorResult.registers) {
      const registerKind: SensorReadingRegisterKind = reading.register
        .isHealthCheck
        ? 'health'
        : 'metric';
      const tags = {
        controller_id: String(result.controller.id),
        sensor_id: String(sensorResult.sensor.id),
        node_id: String(sensorResult.sensor.nodeId),
        register_address: String(reading.register.address),
        register_kind: registerKind,
      };
      const fields: Record<string, LineField> = {
        raw_value: integerField(reading.rawValue),
        controller_name: result.controller.name,
        sensor_name: sensorResult.sensor.name,
        register_name: reading.register.name,
      };

      if (reading.register.isHealthCheck) {
        const statusText = formatHealthStatusText(reading.rawValue);

        fields.health_state_code = integerField(reading.rawValue);
        fields.status_text = statusText;

        if (!result.controller.isMultihop && statusText !== 'UNKNOWN') {
          fields.online = statusText === 'ONLINE';
        }
      } else {
        fields.scaled_value = reading.scaledValue;
        fields.unit = reading.register.unit;
      }

      lines.push(
        `${escapeMeasurement(SENSOR_READINGS_MEASUREMENT)}${formatTags(
          tags,
        )} ${formatFields(fields)} ${timestamp}`,
      );
    }
  }

  return lines.join('\n');
}

export function formatHealthStatusText(rawValue: number): HealthStatusText {
  if (rawValue === 128) return 'ONLINE';
  if (rawValue === 13569) return 'OFFLINE';
  return 'UNKNOWN';
}

function toUnixNanoseconds(date: Date): string {
  return (BigInt(date.getTime()) * 1_000_000n).toString();
}

function formatTags(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `,${escapeTagPart(key)}=${escapeTagPart(value)}`)
    .join('');
}

function formatFields(fields: Record<string, LineField>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${escapeFieldKey(key)}=${formatFieldValue(value)}`)
    .join(',');
}

function formatFieldValue(value: LineField): string {
  if (isIntegerLineField(value)) return `${Math.trunc(value.value)}i`;
  if (typeof value === 'string') return `"${escapeStringField(value)}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function integerField(value: number): IntegerLineField {
  return {
    kind: 'integer',
    value,
  };
}

function isIntegerLineField(value: LineField): value is IntegerLineField {
  return typeof value === 'object' && value.kind === 'integer';
}

function escapeMeasurement(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(',', '\\,')
    .replaceAll(' ', '\\ ');
}

function escapeTagPart(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(',', '\\,')
    .replaceAll(' ', '\\ ')
    .replaceAll('=', '\\=');
}

function escapeFieldKey(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(',', '\\,')
    .replaceAll(' ', '\\ ')
    .replaceAll('=', '\\=');
}

function escapeStringField(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
