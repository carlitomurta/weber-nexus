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

    expect(lineProtocol.split('\n')).toContain(
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

  it('uses separate node health readings to allow metric readings', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResultWithSeparateHealthSensor(128),
    );

    expect(lineProtocol).toContain('sensor_id=8');
    expect(lineProtocol).toContain('status_text="ONLINE"');
    expect(lineProtocol).toContain('sensor_id=7');
    expect(lineProtocol).toContain('register_kind=metric');
  });

  it('uses separate node health readings to block offline metrics', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResultWithSeparateHealthSensor(13569),
    );

    expect(lineProtocol).toContain('sensor_id=8');
    expect(lineProtocol).toContain('status_text="OFFLINE"');
    expect(lineProtocol).not.toContain('sensor_id=7');
    expect(lineProtocol).not.toContain('register_kind=metric');
  });

  it('rejects duplicate node health readings', () => {
    expect(() =>
      buildSensorReadingsLineProtocol(
        pollingResultWithDuplicateHealthSensors(),
      ),
    ).toThrow('Nó 3 deve ter apenas um registrador de status');
  });

  it('writes only offline health status when sensor is offline', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        healthRawValue: 13569,
      }),
    );

    expect(lineProtocol).toContain('status_text="OFFLINE"');
    expect(lineProtocol).toContain('online=false');
    expect(lineProtocol).toContain('register_kind=health');
    expect(lineProtocol).not.toContain('register_kind=metric');
  });

  it('ignores unknown health values', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        rawValue: 12,
        scaledValue: 12,
        isHealthCheck: true,
      }),
    );

    expect(lineProtocol).toBe('');
  });

  it('ignores readings without health status', () => {
    const lineProtocol = buildSensorReadingsLineProtocol(
      pollingResult({
        includeHealthStatus: false,
      }),
    );

    expect(lineProtocol).toBe('');
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
  healthRawValue = 128,
  includeHealthStatus = true,
}: {
  polledAt?: Date;
  controllerName?: string;
  sensorName?: string;
  registerName?: string;
  rawValue?: number;
  scaledValue?: number;
  isHealthCheck?: boolean;
  healthRawValue?: number;
  includeHealthStatus?: boolean;
}): ControllerPollingResult {
  const metricReading = {
    register: {
      name: registerName,
      address: 49,
      unit: 'mm/s',
    },
    rawValue,
    scaledValue,
    displayValue: scaledValue,
  };
  const healthReading = {
    register: {
      name: 'Status',
      address: 16,
      unit: '',
      isHealthCheck: true,
    },
    rawValue: isHealthCheck ? rawValue : healthRawValue,
    scaledValue: isHealthCheck ? scaledValue : healthRawValue,
    displayValue: isHealthCheck ? scaledValue : 'ONLINE',
  };
  const registers = isHealthCheck
    ? [healthReading]
    : [...(includeHealthStatus ? [healthReading] : []), metricReading];

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
        registers,
      },
    ],
    polledAt,
  };
}

function pollingResultWithDuplicateHealthSensors(): ControllerPollingResult {
  const base = pollingResultWithSeparateHealthSensor(128);
  const duplicateHealthSensor = {
    sensor: {
      id: 9,
      controllerId: 1,
      nodeId: 3,
      name: 'N3-Link-B',
      registers: [],
    },
    registers: [
      {
        register: {
          name: 'N3 Link B',
          address: 55,
          unit: '',
          isHealthCheck: true,
        },
        rawValue: 128,
        scaledValue: 128,
        displayValue: 'ONLINE',
      },
    ],
  };

  return {
    ...base,
    results: [base.results[0], duplicateHealthSensor, ...base.results.slice(1)],
  };
}

function pollingResultWithSeparateHealthSensor(
  healthRawValue: number,
): ControllerPollingResult {
  return {
    controller: {
      id: 1,
      name: 'DXM Norte',
      ipAddress: '127.0.0.1',
      pollingIntervalMs: 1000,
      isMultihop: false,
    },
    results: [
      {
        sensor: {
          id: 8,
          controllerId: 1,
          nodeId: 3,
          name: 'N3-Link',
          registers: [],
        },
        registers: [
          {
            register: {
              name: 'N3 Link',
              address: 56,
              unit: '',
              isHealthCheck: true,
            },
            rawValue: healthRawValue,
            scaledValue: healthRawValue,
            displayValue: healthRawValue === 128 ? 'ONLINE' : 'OFFLINE',
          },
        ],
      },
      {
        sensor: {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: 'Bomba 01',
          registers: [],
        },
        registers: [
          {
            register: {
              name: 'Vibração',
              address: 49,
              unit: 'mm/s',
            },
            rawValue: 123,
            scaledValue: 12.3,
            displayValue: 12.3,
          },
        ],
      },
    ],
    polledAt: new Date('2024-06-07T00:00:00.000Z'),
  };
}
