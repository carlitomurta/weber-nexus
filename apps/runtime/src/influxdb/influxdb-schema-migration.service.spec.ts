import { InfluxdbSchemaMigrationService } from './influxdb-schema-migration.service';

jest.mock('@weber-nexus/repository', () => ({
  InfluxConfigsRepository: class {},
  MigrationHistoryRepository: class {},
}));

jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    info = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  },
}));

describe('InfluxdbSchemaMigrationService', () => {
  let influxConfigsRepository: { ensureDefault: jest.Mock };
  let migrationHistoryRepository: {
    findByKindAndVersion: jest.Mock;
    recordResult: jest.Mock;
  };
  let runtimeEnv: { isInfluxdbDisabled: jest.Mock };

  beforeEach(() => {
    influxConfigsRepository = {
      ensureDefault: jest.fn().mockResolvedValue({}),
    };
    migrationHistoryRepository = {
      findByKindAndVersion: jest.fn().mockResolvedValue(undefined),
      recordResult: jest.fn().mockResolvedValue(undefined),
    };
    runtimeEnv = {
      isInfluxdbDisabled: jest.fn().mockReturnValue(false),
    };
  });

  it('applies pending InfluxDB routines once', async () => {
    const service = createService();

    await service.ensureApplied();
    await service.ensureApplied();

    expect(influxConfigsRepository.ensureDefault).toHaveBeenCalledTimes(1);
    expect(migrationHistoryRepository.recordResult).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'influx',
        version: 'influx-schema-v1-default-config',
        status: 'success',
      }),
    );
  });

  it('skips routine already recorded with same checksum', async () => {
    migrationHistoryRepository.findByKindAndVersion.mockResolvedValue({
      status: 'success',
      checksum: 'influx-schema-v1-default-config',
    });
    const service = createService();

    await service.ensureApplied();

    expect(influxConfigsRepository.ensureDefault).not.toHaveBeenCalled();
    expect(migrationHistoryRepository.recordResult).not.toHaveBeenCalled();
  });

  it('records failed routine before rethrowing', async () => {
    influxConfigsRepository.ensureDefault.mockRejectedValue(new Error('falha'));
    const service = createService();

    await expect(service.ensureApplied()).rejects.toThrow('falha');
    expect(migrationHistoryRepository.recordResult).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'influx',
        status: 'failed',
        errorMessage: 'falha',
      }),
    );
  });

  function createService(): InfluxdbSchemaMigrationService {
    return new InfluxdbSchemaMigrationService(
      influxConfigsRepository as never,
      migrationHistoryRepository as never,
      runtimeEnv as never,
    );
  }
});
