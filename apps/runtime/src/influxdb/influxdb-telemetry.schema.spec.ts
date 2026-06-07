import type { ControllerPollingResult } from '@weber-nexus/polling-engine';
import {
  buildSensorReadingsLineProtocol,
  formatHealthStatusText,
} from './influxdb-telemetry.schema';

describe('InfluxDB telemetry schema', () => {
  it('builds metric line protocol with escaped string fields and ns timestamps', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        polledAt: new Date('2024-06-07T00:00:00.123Z'),
        controllerName: 'DXM "Norte"',
        sensorName: 'Bomba \\ 01',
        registerName: 'Vibração',
      }),
    );

    expect(lineProtocol).toBe(
      'sensor_readings,controller_id=1,sensor_id=7,node_id=3,register_address=49,register_kind=metric raw_value=123i,controller_name="DXM \\"Norte\\"",sensor_name="Bomba \\\\ 01",register_name="Vibração",scaled_value=12.3,unit="mm/s" 1717718400123000000',
    );
  });

  it('builds non-multihop health line protocol with status fields', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        rawValue: 128,
        scaledValue: 128,
        isHealthCheck: true,
      }),
    );

    expect(lineProtocol).toContain('register_kind=health');
    expect(lineProtocol).toContain('raw_value=128i');
    expect(lineProtocol).toContain('health_state_code=128i');
    expect(lineProtocol).toContain('online=true');
    expect(lineProtocol).toContain('status_text="ONLINE"');
    expect(lineProtocol).not.toContain('scaled_value=');
    expect(lineProtocol).not.toContain('unit=');
  });

  it('writes scaled values as floats even when they look like integers', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        scaledValue: 12,
      }),
    );

    expect(lineProtocol).toContain('scaled_value=12,');
    expect(lineProtocol).not.toContain('scaled_value=12i');
  });

  it('does not write online field for unknown health values', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        rawValue: 12,
        scaledValue: 12,
        isHealthCheck: true,
      }),
    );

    expect(lineProtocol).toContain('status_text="UNKNOWN"');
    expect(lineProtocol).not.toContain('online=');
  });

  it('formats known non-multihop health values', () => {
    expect(formatHealthStatusText(128)).toBe('ONLINE');
    expect(formatHealthStatusText(13569)).toBe('OFFLINE');
    expect(formatHealthStatusText(1)).toBe('UNKNOWN');
  });
});

function pollingResult({
  polledAt = new Date('2024-06-07T00:00:00.000Z'),
  controllerName = 'DXM Norte',
  sensorName = 'Bomba 01',
  registerName = 'Vibração',
  rawValue = 123,
  scaledValue = 12.3,
  isHealthCheck = false,
}: {
  polledAt?: Date;
  controllerName?: string;
  sensorName?: string;
  registerName?: string;
  rawValue?: number;
  scaledValue?: number;
  isHealthCheck?: boolean;
}): ControllerPollingResult {
  return {
    controller: {
      id: 1,
      name: controllerName,
      ipAddress: '127.0.0.1',
      pollingIntervalMs: 1000,
      isMultihop: false,
    },
    results: [
      {
        sensor: {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: sensorName,
          registers: [],
        },
        registers: [
          {
            register: {
              name: registerName,
              address: 49,
              unit: isHealthCheck ? '' : 'mm/s',
              isHealthCheck,
            },
            rawValue,
            scaledValue,
            displayValue: scaledValue,
          },
        ],
      },
    ],
    polledAt,
  };
}
