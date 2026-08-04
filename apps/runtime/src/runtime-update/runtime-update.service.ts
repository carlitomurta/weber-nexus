import { Injectable } from '@nestjs/common';
import {
  ControllersRepository,
  InfluxConfigsRepository,
  SensorsRepository,
} from '@weber-nexus/repository';
import { RuntimeEnvService } from '../config/runtime-env.service';
import { InfluxdbTelemetryService } from '../influxdb/influxdb-telemetry.service';
import { PollingRuntimeService } from '../polling/polling-runtime.service';
import type {
  RuntimeComponentHealth,
  RuntimeUpdateHealthCheck,
  RuntimeUpdatePreparationResult,
  RuntimeUpdateStatus,
} from './runtime-update.types';

@Injectable()
export class RuntimeUpdateService {
  private status: RuntimeUpdateStatus;
  private lastError: string | null = null;
  private lastPreparedAtUtc: string | null = null;
  private lastHealthCheckAtUtc: string | null = null;

  constructor(
    private readonly pollingRuntimeService: PollingRuntimeService,
    private readonly influxdbTelemetryService: InfluxdbTelemetryService,
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly runtimeEnv: RuntimeEnvService,
  ) {
    this.status = runtimeEnv.isRuntimeMaintenanceEnabled()
      ? 'maintenance'
      : 'idle';
  }

  currentStatus(): {
    status: RuntimeUpdateStatus;
    last_error: string | null;
    last_prepared_at_utc: string | null;
    last_health_check_at_utc: string | null;
    polling: ReturnType<PollingRuntimeService['health']>;
  } {
    return {
      status: this.status,
      last_error: this.lastError,
      last_prepared_at_utc: this.lastPreparedAtUtc,
      last_health_check_at_utc: this.lastHealthCheckAtUtc,
      polling: this.pollingRuntimeService.health(),
    };
  }

  async prepareForUpdate(): Promise<RuntimeUpdatePreparationResult> {
    this.status = 'maintenance';
    this.lastError = null;
    this.pollingRuntimeService.pauseForUpdate();

    const queueCheckpoint =
      await this.influxdbTelemetryService.checkpointQueueForUpdate();

    this.status = 'ready_for_update';
    this.lastPreparedAtUtc = new Date().toISOString();

    return {
      status: 'ready_for_update',
      polling_paused: true,
      pending_queue_items: queueCheckpoint.pendingQueueItems,
      prepared_at_utc: this.lastPreparedAtUtc,
      message:
        'Runtime preparado para atualização. Coleta pausada e fila persistente preservada.',
    };
  }

  enterMaintenance(): {
    status: 'maintenance';
    entered_at_utc: string;
    message: string;
  } {
    this.status = 'maintenance';
    this.pollingRuntimeService.pauseForUpdate();

    return {
      status: 'maintenance',
      entered_at_utc: new Date().toISOString(),
      message: 'Runtime em modo manutenção.',
    };
  }

  async runFinalHealthCheck(): Promise<RuntimeUpdateHealthCheck> {
    this.status = 'health_check';
    this.lastError = null;
    this.lastHealthCheckAtUtc = new Date().toISOString();

    const sqlite = await this.checkSqlite();
    const influxdb = await this.checkInfluxdb();
    const polling = this.checkPolling();
    const api = healthy('API local disponível.');
    const failed = [sqlite, influxdb, polling, api].some(
      (component) => component.status === 'failed',
    );

    if (failed) {
      this.status = 'maintenance';
      this.lastError = 'Health check final falhou.';

      return {
        status: 'maintenance',
        checked_at_utc: this.lastHealthCheckAtUtc,
        sqlite,
        influxdb,
        polling,
        api,
        message:
          'Health check final falhou. Runtime permanece em modo manutenção.',
      };
    }

    await this.pollingRuntimeService.resumeAfterUpdate();
    this.status = 'healthy';

    return {
      status: 'healthy',
      checked_at_utc: this.lastHealthCheckAtUtc,
      sqlite,
      influxdb,
      polling,
      api,
      message: 'Health check final concluído. Runtime liberado para operação.',
    };
  }

  private async checkSqlite(): Promise<RuntimeComponentHealth> {
    try {
      await Promise.all([
        this.controllersRepository.findAll(),
        this.sensorsRepository.findAll(),
      ]);

      return healthy('SQLite disponível.');
    } catch (error) {
      return failed(
        `SQLite indisponível: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async checkInfluxdb(): Promise<RuntimeComponentHealth> {
    if (this.runtimeEnv.isInfluxdbDisabled()) {
      return {
        status: 'skipped',
        message: 'InfluxDB desabilitado neste ambiente.',
      };
    }

    try {
      await this.influxConfigsRepository.ensureDefault();
      return healthy('Configuração do InfluxDB disponível.');
    } catch (error) {
      return failed(
        `InfluxDB indisponível: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private checkPolling(): RuntimeComponentHealth {
    const polling = this.pollingRuntimeService.health();

    if (polling.pausedForUpdate && this.status !== 'health_check') {
      return failed('Coleta ainda pausada para atualização.');
    }

    return healthy('Motor de coleta controlado pelo Runtime.');
  }
}

function healthy(message: string): RuntimeComponentHealth {
  return {
    status: 'healthy',
    message,
  };
}

function failed(message: string): RuntimeComponentHealth {
  return {
    status: 'failed',
    message,
  };
}
