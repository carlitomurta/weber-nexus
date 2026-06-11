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

@Injectable()
export class PollingRuntimeService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('runtime/polling-runtime.service.ts');

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
    onError: (error, controller) => {
      this.logger.error(
        `Falha na coleta do controlador ID ${controller.id} (${controller.name}) IP ${controller.ipAddress}`,
        error,
      );
    },
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
    this.logPollingResult(result);
    await this.influxdbTelemetryService.writePollingResult(result);
  }

  private logPollingResult(result: ControllerPollingResult): void {
    const readings = result.results.map((sensorResult) => ({
      sensorId: sensorResult.sensor.id,
      sensorName: sensorResult.sensor.name,
      nodeId: sensorResult.sensor.nodeId,
      registers: sensorResult.registers,
    }));

    this.logger.info(
      `[COLETADO]: ${result.polledAt.toLocaleTimeString()}`,
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
