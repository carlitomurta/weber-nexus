import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import {
  PollingEngine,
  type ControllerPollingResult,
} from '@weber-nexus/polling-engine';
import {
  ControllersRepository,
  SensorsRepository,
  type Controller,
  type Sensor,
} from '@weber-nexus/repository';
import { InfluxdbTelemetryService } from '../influxdb/influxdb-telemetry.service';
import {
  toPollingController,
  toPollingSensors,
} from './polling-controller.mapper';

export type RawHoldingRegisterSnapshot = {
  controllerId: number;
  controllerName: string;
  ipAddress: string;
  polledAt: string;
  registers: RawHoldingRegisterValue[];
};

export type RawHoldingRegisterValue = {
  sensorId: number;
  sensorName: string;
  nodeId: number;
  registerName: string;
  registerAddress: number;
  localRegisterNumber: number | null;
  rawValue: number;
};

@Injectable()
export class PollingRuntimeService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('runtime/polling-runtime.service.ts');
  private readonly rawHoldingRegisterSnapshots = new Map<
    number,
    RawHoldingRegisterSnapshot
  >();

  private readonly pollingEngine = new PollingEngine({
    retry: {
      attempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5000,
    },
    onConnection: (controller) => {
      this.logger.info(
        `Controlador ${controller.id} (${controller.name}) conectado em ${controller.ipAddress} via ${controller.protocol ?? 'modbus-tcp'}`,
      );
    },
    onData: (result) => this.handlePollingResult(result),
    onError: (error, controller) => this.handlePollingError(error, controller),
  });

  constructor(
    private readonly controllersRepository: ControllersRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly influxdbTelemetryService: InfluxdbTelemetryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const controllers = await this.controllersRepository.findAll();

    this.logger.info(
      `Motor de coleta iniciado para ${controllers.length} controlador(es)`,
    );

    for (const controller of controllers) {
      await this.refreshController(controller.id);
    }
  }

  onApplicationShutdown(): void {
    this.pollingEngine.stop();
  }

  stopController(controllerId: number): void {
    this.pollingEngine.stopController(controllerId);
    this.rawHoldingRegisterSnapshots.delete(controllerId);
  }

  getLatestRawHoldingRegisterSnapshots(): RawHoldingRegisterSnapshot[] {
    return [...this.rawHoldingRegisterSnapshots.values()].sort(
      (a, b) => a.controllerId - b.controllerId,
    );
  }

  async refreshController(controllerId: number): Promise<void> {
    try {
      const controller =
        await this.controllersRepository.findById(controllerId);

      if (!controller) {
        this.logger.warn(
          `Controlador ${controllerId} não encontrado para coleta`,
        );
        this.pollingEngine.stopController(controllerId);
        return;
      }

      const sensors = await this.sensorsRepository.findByControllerId(
        controller.id,
      );

      this.startControllerPolling(controller, sensors);
    } catch (error) {
      this.logger.error(
        `Falha ao atualizar coleta do controlador ${controllerId}`,
        error,
      );
    }
  }

  private startControllerPolling(
    controller: Controller,
    sensors: Sensor[],
  ): void {
    if (sensors.length === 0) {
      this.logger.warn(
        `Controlador ${controller.id} (${controller.name}) não possui sensores para coleta`,
      );
      return;
    }

    this.pollingEngine.startController(
      toPollingController(controller),
      toPollingSensors(sensors),
    );

    this.logger.info(
      `Coleta iniciada para controlador ${controller.id} (${controller.name}) a cada ${controller.pollingIntervalMs}ms`,
    );
  }

  private async handlePollingResult(
    result: ControllerPollingResult,
  ): Promise<void> {
    this.rawHoldingRegisterSnapshots.set(
      result.controller.id,
      toRawHoldingRegisterSnapshot(result),
    );
    this.logPollingResult(result);
    await this.markControllerPollingStatus(result.controller.id, 'active');
    await this.influxdbTelemetryService.writePollingResult(result);
  }

  private async handlePollingError(
    error: unknown,
    controller: ControllerPollingResult['controller'],
  ): Promise<void> {
    this.logger.error(
      `Falha na coleta do controlador ID ${controller.id} (${controller.name}) IP ${controller.ipAddress}`,
      error,
    );
    await this.markControllerPollingStatus(controller.id, 'offline');
  }

  private async markControllerPollingStatus(
    controllerId: number,
    operationalStatus: 'active' | 'offline',
  ): Promise<void> {
    try {
      await this.controllersRepository.updateOperationalStatus(
        controllerId,
        operationalStatus,
      );
      await this.sensorsRepository.updateOperationalStatusByControllerId(
        controllerId,
        operationalStatus,
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao atualizar status operacional do controlador ${controllerId}`,
        error,
      );
    }
  }

  private logPollingResult(result: ControllerPollingResult): void {
    const readings = result.results.map((sensorResult) => ({
      sensorId: sensorResult.sensor.id,
      sensorName: sensorResult.sensor.name,
      nodeId: sensorResult.sensor.nodeId,
      registers: sensorResult.registers,
    }));

    this.logger.info(
      `[COLETADO]: ${result.polledAt.toISOString()}`,
      readings.map((r) =>
        r.registers
          .map(
            (a) =>
              `${a.register.name}: ${a.displayValue}${
                a.register.isHealthCheck ? '' : a.register.unit
              }`,
          )
          .join(', '),
      ),
    );
  }
}

function toRawHoldingRegisterSnapshot(
  result: ControllerPollingResult,
): RawHoldingRegisterSnapshot {
  return {
    controllerId: result.controller.id,
    controllerName: result.controller.name,
    ipAddress: result.controller.ipAddress,
    polledAt: result.polledAt.toISOString(),
    registers: result.results
      .flatMap((sensorResult) =>
        sensorResult.registers.map((registerResult) => ({
          sensorId: sensorResult.sensor.id,
          sensorName: sensorResult.sensor.name,
          nodeId: sensorResult.sensor.nodeId,
          registerName: registerResult.register.name,
          registerAddress: registerResult.register.address,
          localRegisterNumber:
            registerResult.register.localRegisterNumber ?? null,
          rawValue: registerResult.rawValue,
        })),
      )
      .sort((a, b) => {
        const localA = a.localRegisterNumber ?? Number.MAX_SAFE_INTEGER;
        const localB = b.localRegisterNumber ?? Number.MAX_SAFE_INTEGER;

        if (localA !== localB) {
          return localA - localB;
        }

        return a.registerAddress - b.registerAddress;
      }),
  };
}
