import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import {
  InfluxConfigsRepository,
  MigrationHistoryRepository,
} from '@weber-nexus/repository';
import { RuntimeEnvService } from '../config/runtime-env.service';

type InfluxSchemaRoutine = {
  version: string;
  checksum: string;
  run(): Promise<void>;
};

@Injectable()
export class InfluxdbSchemaMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(
    'runtime/influxdb-schema-migration.service.ts',
  );
  private applied = false;
  private running: Promise<void> | null = null;

  constructor(
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly migrationHistoryRepository: MigrationHistoryRepository,
    private readonly runtimeEnv: RuntimeEnvService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureApplied();
  }

  async ensureApplied(): Promise<void> {
    if (this.applied) return;

    this.running ??= this.applyRoutines();
    await this.running;
  }

  private async applyRoutines(): Promise<void> {
    if (this.runtimeEnv.isInfluxdbDisabled()) {
      this.logger.warn(
        'Rotinas InfluxDB ignoradas porque InfluxDB está desabilitado.',
      );
      this.applied = true;
      return;
    }

    for (const routine of this.routines()) {
      await this.applyRoutine(routine);
    }

    this.applied = true;
  }

  private routines(): InfluxSchemaRoutine[] {
    return [
      {
        version: 'influx-schema-v1-default-config',
        checksum: 'influx-schema-v1-default-config',
        run: async () => {
          await this.influxConfigsRepository.ensureDefault();
        },
      },
    ];
  }

  private async applyRoutine(routine: InfluxSchemaRoutine): Promise<void> {
    const existing = await this.migrationHistoryRepository.findByKindAndVersion(
      'influx',
      routine.version,
    );

    if (
      existing?.status === 'success' &&
      existing.checksum === routine.checksum
    ) {
      return;
    }

    const startedAtUtc = new Date().toISOString();

    try {
      await routine.run();
      await this.migrationHistoryRepository.recordResult({
        kind: 'influx',
        version: routine.version,
        status: 'success',
        startedAtUtc,
        finishedAtUtc: new Date().toISOString(),
        checksum: routine.checksum,
      });
    } catch (error) {
      await this.migrationHistoryRepository.recordResult({
        kind: 'influx',
        version: routine.version,
        status: 'failed',
        startedAtUtc,
        finishedAtUtc: new Date().toISOString(),
        checksum: routine.checksum,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
