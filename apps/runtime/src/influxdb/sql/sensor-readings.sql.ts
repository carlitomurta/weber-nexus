import type { Sensor } from '@weber-nexus/repository';

export type ReadingRegister = {
  controllerId: number;
  sensorId: number;
  registerAddress: number;
};

export type SensorReadingsQuery = {
  start: Date;
  end: Date;
  registers: ReadingRegister[];
};

export const SENSOR_READINGS_SELECT_COLUMNS = [
  'time',
  'controller_id',
  'sensor_id',
  'node_id',
  'register_address',
  'register_kind',
  'raw_value',
  'scaled_value',
  'unit',
  'health_state_code',
  'online',
  'status_text',
  'controller_name',
  'sensor_name',
  'register_name',
] as const;

export function buildSensorReadingsSql(query: SensorReadingsQuery): string {
  const where = [
    `time >= '${sqlString(query.start.toISOString())}'`,
    `time < '${sqlString(query.end.toISOString())}'`,
    `(${registerWhereClause(query.registers)})`,
  ];

  return [
    `SELECT ${SENSOR_READINGS_SELECT_COLUMNS.join(', ')}`,
    'FROM sensor_readings',
    `WHERE ${where.join(' AND ')}`,
    'ORDER BY time ASC',
  ].join(' ');
}

export function buildReadingRegisterBatches(
  sensors: Sensor[],
  batchSize: number,
): ReadingRegister[][] {
  const registers = sensors.flatMap((sensor) =>
    sensor.registers
      .filter((register) => !register.isHealthCheck)
      .map((register) => ({
        controllerId: sensor.controllerId,
        sensorId: sensor.id,
        registerAddress: register.address,
      })),
  );

  return chunk(registers, batchSize);
}

function registerWhereClause(registers: ReadingRegister[]): string {
  return registers
    .map(
      (register) =>
        `(controller_id = '${sqlString(register.controllerId)}' AND sensor_id = '${sqlString(register.sensorId)}' AND register_address = '${sqlString(register.registerAddress)}')`,
    )
    .join(' OR ');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sqlString(value: string | number): string {
  return String(value).replaceAll("'", "''");
}
