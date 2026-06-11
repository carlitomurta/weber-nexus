import {
  createControllerConnection,
  type ConnectionProtocol,
  type ControllerConnection,
} from "@weber-nexus/modbus";

export type PollingController = {
  id: number;
  name: string;
  ipAddress: string;
  pollingIntervalMs: number;
  isMultihop?: boolean | null;
  protocol?: ConnectionProtocol;
};

export type PollingSensor = {
  id: number;
  controllerId: number;
  nodeId: number;
  name: string;
  registers: PollingSensorRegister[];
};

export type PollingSensorRegister = {
  name: string;
  address: number;
  scaleType?: "multiply" | "divide";
  scaleFactor?: number;
  unit: string;
  isHealthCheck?: boolean;
};

export type SensorRegisterPollingResult = {
  register: PollingSensorRegister;
  rawValue: number;
  scaledValue: number;
  displayValue: string | number;
};

export type SensorPollingResult = {
  sensor: PollingSensor;
  registers: SensorRegisterPollingResult[];
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

const DXM_LOCAL_REGISTER_UNIT_ID = 199;

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

    const registerPlan = createControllerRegisterPlan(job.sensors);
    const holdingRegisters = await job.connection.readHoldingRegisters(
      DXM_LOCAL_REGISTER_UNIT_ID,
      registerPlan.map((entry) => entry.register.address),
    );

    const readsByKey = new Map<string, SensorRegisterPollingResult>();

    registerPlan.forEach((entry, index) => {
      const rawValue = holdingRegisters[index]?.values[0];

      if (rawValue === undefined) {
        throw new Error(
          `Valor ausente no controlador ${job.controller.id}, registro ${entry.register.address}`,
        );
      }

      const scaledValue = applyScale(rawValue, entry.register);

      readsByKey.set(registerPlanKey(entry), {
        register: entry.register,
        rawValue,
        scaledValue,
        displayValue: formatRegisterValue(
          job.controller,
          entry.register,
          rawValue,
          scaledValue,
        ),
      });
    });

    const results: SensorPollingResult[] = [];

    for (const sensor of job.sensors) {
      const registers = [...sensor.registers]
        .sort((a, b) => a.address - b.address)
        .map((register) => {
          const reading = readsByKey.get(registerPlanKey({ sensor, register }));

          if (!reading) {
            throw new Error(
              `Valor mapeado ausente no sensor ${sensor.id}, registro ${register.address}`,
            );
          }

          return reading;
        });

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

type ControllerRegisterPlanEntry = {
  sensor: PollingSensor;
  register: PollingSensorRegister;
};

function createControllerRegisterPlan(
  sensors: PollingSensor[],
): ControllerRegisterPlanEntry[] {
  const entries = sensors.flatMap((sensor) =>
    sensor.registers.map((register) => ({
      sensor,
      register,
    })),
  );
  const duplicateAddresses = findDuplicateAddresses(entries);

  if (duplicateAddresses.length > 0) {
    throw new Error(
      `Configuração duplicada de endereço de registrador holding: ${duplicateAddresses.join(", ")}`,
    );
  }

  return entries.sort((a, b) => {
    if (a.register.address !== b.register.address) {
      return a.register.address - b.register.address;
    }

    return a.sensor.id - b.sensor.id;
  });
}

function findDuplicateAddresses(
  entries: ControllerRegisterPlanEntry[],
): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const entry of entries) {
    if (seen.has(entry.register.address)) {
      duplicates.add(entry.register.address);
      continue;
    }

    seen.add(entry.register.address);
  }

  return [...duplicates].sort((a, b) => a - b);
}

function registerPlanKey(entry: ControllerRegisterPlanEntry): string {
  return `${entry.sensor.id}:${entry.register.address}`;
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

function applyScale(
  rawValue: number,
  register: PollingSensorRegister,
): number {
  if (register.isHealthCheck) return rawValue;
  if (register.scaleType === undefined || register.scaleFactor === undefined) {
    return rawValue;
  }

  if (register.scaleType === "divide") return rawValue / register.scaleFactor;
  return rawValue * register.scaleFactor;
}

function formatRegisterValue(
  controller: PollingController,
  register: PollingSensorRegister,
  rawValue: number,
  scaledValue: number,
): string | number {
  if (!register.isHealthCheck || controller.isMultihop) {
    return scaledValue;
  }

  if (rawValue === 128) return "ONLINE";
  if (rawValue === 13569) return "OFFLINE";
  return rawValue;
}
