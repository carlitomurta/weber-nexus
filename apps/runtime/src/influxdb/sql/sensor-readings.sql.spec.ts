import {
  buildReadingRegisterBatches,
  buildSensorReadingsSql,
} from './sensor-readings.sql';

describe('Sensor readings SQL', () => {
  it('builds maintainable InfluxDB SQL for sensor readings', () => {
    const sql = buildSensorReadingsSql({
      start: new Date('2025-12-07T12:00:00.000Z'),
      end: new Date('2026-06-07T12:00:00.000Z'),
      registers: [
        {
          controllerId: 1,
          sensorId: 7,
          registerAddress: 49,
        },
      ],
    });

    expect(sql).toContain(
      'SELECT time, controller_id, sensor_id, node_id, register_address',
    );
    expect(sql).toContain('FROM sensor_readings');
    expect(sql).toContain(
      "WHERE time >= '2025-12-07T12:00:00.000Z' AND time < '2026-06-07T12:00:00.000Z'",
    );
    expect(sql).toContain(
      "controller_id = '1' AND sensor_id = '7' AND register_address = '49'",
    );
    expect(sql).toContain('ORDER BY time ASC');
  });

  it('batches only non-health sensor registers', () => {
    const batches = buildReadingRegisterBatches(
      [
        {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: 'Bomba 01',
          registers: [
            { name: 'Health', address: 48, isHealthCheck: true },
            { name: 'Vibração', address: 49, unit: 'mm/s' },
            { name: 'Temperatura', address: 50, unit: 'C' },
          ],
        },
      ] as never,
      1,
    );

    expect(batches).toEqual([
      [{ controllerId: 1, sensorId: 7, registerAddress: 49 }],
      [{ controllerId: 1, sensorId: 7, registerAddress: 50 }],
    ]);
  });

  it('batches health sensor registers when requested', () => {
    const batches = buildReadingRegisterBatches(
      [
        {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: 'Bomba 01',
          registers: [
            { name: 'Status', address: 48, isHealthCheck: true },
            { name: 'Vibração', address: 49, unit: 'mm/s' },
          ],
        },
      ] as never,
      1,
      { includeHealth: true },
    );

    expect(batches).toEqual([
      [{ controllerId: 1, sensorId: 7, registerAddress: 48 }],
      [{ controllerId: 1, sensorId: 7, registerAddress: 49 }],
    ]);
  });
});
