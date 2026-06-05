import {
  createControllerConnection,
  type ConnectionProtocol,
  type ControllerConnection,
  type HoldingRegisterRead,
} from "@weber-nexus/modbus";

export type PollingController = {
  id: number;
  name: string;
  ipAddress: string;
  pollingIntervalMs: number;
  protocol?: ConnectionProtocol;
};

export type PollingSensor = {
  id: number;
  controllerId: number;
  modbusId: number;
  name: string;
  registers: number[];
};

export type SensorPollingResult = {
  sensor: PollingSensor;
  registers: HoldingRegisterRead[];
};

export type ControllerPollingResult = {
  controller: PollingController;
  results: SensorPollingResult[];
  polledAt: Date;
};

export type PollingEngineOptions = {
  onConnection?: (controller: PollingController) => void;
  onData?: (result: ControllerPollingResult) => void | Promise<void>;
  onError?: (error: unknown, controller: PollingController) => void;
  retry?: {
    attempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
};

type ControllerPollingJob = {
  controller: PollingController;
  sensors: PollingSensor[];
  connection: ControllerConnection;
  timer?: NodeJS.Timeout;
  connectionLogged: boolean;
  running: boolean;
};

export class PollingEngine {
  private readonly jobs = new Map<number, ControllerPollingJob>();

  constructor(private readonly options: PollingEngineOptions = {}) {}

  startController(
    controller: PollingController,
    sensors: PollingSensor[],
  ): void {
    this.stopController(controller.id);

    const job: ControllerPollingJob = {
      controller,
      sensors,
      connection: createControllerConnection({
        protocol: controller.protocol,
        host: controller.ipAddress,
        timeoutMs: 5000,
      }),
      connectionLogged: false,
      running: false,
    };

    this.jobs.set(controller.id, job);
    void this.poll(job);
    job.timer = setInterval(
      () => void this.poll(job),
      normalizePollingInterval(controller.pollingIntervalMs),
    );
  }

  stopController(controllerId: number): void {
    const job = this.jobs.get(controllerId);
    if (!job) return;

    if (job.timer) clearInterval(job.timer);
    void job.connection.close();
    this.jobs.delete(controllerId);
  }

  stop(): void {
    for (const controllerId of this.jobs.keys()) {
      this.stopController(controllerId);
    }
  }

  private async poll(job: ControllerPollingJob): Promise<void> {
    if (job.running) return;

    job.running = true;

    try {
      await this.runWithRetry(job, () => this.readController(job));
    } catch (error) {
      this.options.onError?.(error, job.controller);
      await job.connection.close();
      job.connectionLogged = false;
    } finally {
      job.running = false;
    }
  }

  private async readController(job: ControllerPollingJob): Promise<void> {
    await job.connection.connect();
    if (!job.connectionLogged) {
      this.options.onConnection?.(job.controller);
      job.connectionLogged = true;
    }

    const results: SensorPollingResult[] = [];

    for (const sensor of job.sensors) {
      const registers = await job.connection.readHoldingRegisters(
        sensor.modbusId,
        sensor.registers,
      );

      results.push({
        sensor,
        registers,
      });
    }

    await this.options.onData?.({
      controller: job.controller,
      results,
      polledAt: new Date(),
    });
  }

  private async runWithRetry(
    job: ControllerPollingJob,
    operation: () => Promise<void>,
  ): Promise<void> {
    const attempts = this.options.retry?.attempts ?? 3;
    const initialDelayMs = this.options.retry?.initialDelayMs ?? 500;
    const maxDelayMs = this.options.retry?.maxDelayMs ?? 5000;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;

        if (attempt >= attempts) break;

        await job.connection.close();
        job.connectionLogged = false;
        await sleep(
          Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs),
        );
      }
    }

    throw lastError;
  }
}

function normalizePollingInterval(intervalMs: number): number {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return 300000;
  return intervalMs;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
