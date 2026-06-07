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
        `Connected to controller ${controller.id} (${controller.name}) at ${controller.ipAddress}:502 via Modbus TCP`,
      );
    },
    onData: (result) => this.handlePollingResult(result),
    onError: (error, controller) => {
      this.logger.error(
        `Polling failed for controller ID ${controller.id} (${controller.name}) IP ${controller.ipAddress}`,
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
      `Polling engine initialized for ${controllers.length} controller(s)`,
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
          `Controller ${controllerId} was not found for polling`,
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
        `Failed to refresh polling for controller ${controllerId}`,
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
        `Controller ${controller.id} (${controller.name}) has no sensors to poll`,
      );
      return;
    }

    this.pollingEngine.startController(
      {
        id: controller.id,
        name: controller.name,
        ipAddress: controller.ipAddress,
        pollingIntervalMs: controller.pollingIntervalMs,
        isMultihop: controller.isMultihop,
      },
      sensors.map((sensor) => ({
        id: sensor.id,
        controllerId: sensor.controllerId,
        nodeId: sensor.nodeId,
        name: sensor.name,
        registers: sensor.registers.map((register) => {
          const legacyRegister = register as typeof register & {
            scale?: number;
          };

          return {
            name: register.name,
            address: register.address,
            scaleType: register.isHealthCheck ? undefined : register.scaleType,
            scaleFactor: register.isHealthCheck
              ? undefined
              : (register.scaleFactor ?? legacyRegister.scale),
            unit: register.unit ?? '',
            isHealthCheck: register.isHealthCheck,
          };
        }),
      })),
    );

    this.logger.info(
      `Started polling controller ${controller.id} (${controller.name}) every ${controller.pollingIntervalMs}ms`,
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
      `[PULLED]: ${result.polledAt.toLocaleTimeString()}`,
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
