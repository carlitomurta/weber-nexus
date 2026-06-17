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
  localRegisterNumber?: number;
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
  onError?: (
    error: unknown,
    controller: PollingController,
  ) => void | Promise<void>;
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
type SensorHealthStatus = "ONLINE" | "OFFLINE";

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
      await this.options.onError?.(error, job.controller);
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

    assertSingleStatusRegisterPerNode(job.sensors);

    const registerPlan = createControllerRegisterPlan(job.sensors);
    const healthRegisterPlan = registerPlan.filter(
      (entry) => entry.register.isHealthCheck,
    );
    const healthReadsByKey = await this.readRegisterPlan(
      job,
      healthRegisterPlan,
      { allowMissing: true },
    );
    const statusByNodeId = new Map<number, SensorHealthStatus>();

    for (const sensor of job.sensors) {
      const healthRegister = sensor.registers.find(
        (register) => register.isHealthCheck,
      );
      const healthReading =
        healthRegister &&
        healthReadsByKey.get(
          registerPlanKey({ sensor, register: healthRegister }),
        );
      const status = sensorHealthStatus(healthReading?.rawValue);

      if (status) {
        statusByNodeId.set(sensor.nodeId, status);
      }
    }

    const onlineRegisterPlan = registerPlan.filter(
      (entry) =>
        !entry.register.isHealthCheck &&
        statusByNodeId.get(entry.sensor.nodeId) === "ONLINE",
    );
    const onlineReadsByKey = await this.readRegisterPlan(
      job,
      onlineRegisterPlan,
      { allowMissing: false },
    );
    const readsByKey = new Map([...healthReadsByKey, ...onlineReadsByKey]);

    const results: SensorPollingResult[] = [];

    for (const sensor of job.sensors) {
      const status = statusByNodeId.get(sensor.nodeId);

      if (!status) continue;

      const registers = [...sensor.registers]
        .filter(
          (register) =>
            status === "ONLINE" || register.isHealthCheck === true,
        )
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

      if (registers.length === 0) continue;

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

  private async readRegisterPlan(
    job: ControllerPollingJob,
    registerPlan: ControllerRegisterPlanEntry[],
    options: { allowMissing: boolean },
  ): Promise<Map<string, SensorRegisterPollingResult>> {
    if (registerPlan.length === 0) return new Map();

    const holdingRegisters = await job.connection.readHoldingRegisters(
      DXM_LOCAL_REGISTER_UNIT_ID,
      registerPlan.map((entry) => entry.localRegisterNumber),
    );
    const readsByKey = new Map<string, SensorRegisterPollingResult>();

    registerPlan.forEach((entry, index) => {
      const rawValue = holdingRegisters[index]?.values[0];

      if (rawValue === undefined) {
        if (options.allowMissing) return;

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

    return readsByKey;
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
  localRegisterNumber: number;
};

function createControllerRegisterPlan(
  sensors: PollingSensor[],
): ControllerRegisterPlanEntry[] {
  const orderedEntries = sensors
    .flatMap((sensor) =>
      sensor.registers.map((register) => ({
        sensor,
        register,
      })),
    )
    .sort((a, b) => {
      if (a.register.address !== b.register.address) {
        return a.register.address - b.register.address;
      }

      return a.sensor.id - b.sensor.id;
    });
  const entries = orderedEntries.map((entry, index) => ({
    ...entry,
    localRegisterNumber: normalizedLocalRegisterNumber(entry.register, index),
  }));
  const duplicateAddresses = findDuplicateLocalRegisters(entries);

  if (duplicateAddresses.length > 0) {
    throw new Error(
      `Configuração duplicada de registrador local holding: ${duplicateAddresses.join(", ")}`,
    );
  }

  return entries.sort((a, b) => a.localRegisterNumber - b.localRegisterNumber);
}

function findDuplicateLocalRegisters(
  entries: ControllerRegisterPlanEntry[],
): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const entry of entries) {
    if (seen.has(entry.localRegisterNumber)) {
      duplicates.add(entry.localRegisterNumber);
      continue;
    }

    seen.add(entry.localRegisterNumber);
  }

  return [...duplicates].sort((a, b) => a - b);
}

function normalizedLocalRegisterNumber(
  register: PollingSensorRegister,
  fallbackIndex: number,
): number {
  if (
    register.localRegisterNumber !== undefined &&
    Number.isInteger(register.localRegisterNumber) &&
    register.localRegisterNumber > 0
  ) {
    return register.localRegisterNumber;
  }

  return fallbackIndex + 1;
}

function registerPlanKey(
  entry: Pick<ControllerRegisterPlanEntry, "sensor" | "register">,
): string {
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

function sensorHealthStatus(
  rawValue: number | undefined,
): SensorHealthStatus | undefined {
  if (rawValue === 128) return "ONLINE";
  if (rawValue === 13569) return "OFFLINE";
  return undefined;
}

function assertSingleStatusRegisterPerNode(sensors: PollingSensor[]): void {
  const statusCountsByNodeId = new Map<number, number>();

  for (const sensor of sensors) {
    const statusCount = sensor.registers.filter(
      (register) => register.isHealthCheck === true,
    ).length;

    if (statusCount === 0) continue;

    const nextCount =
      (statusCountsByNodeId.get(sensor.nodeId) ?? 0) + statusCount;

    if (nextCount > 1) {
      throw new Error(
        `Nó ${sensor.nodeId} deve ter apenas um registrador de status`,
      );
    }

    statusCountsByNodeId.set(sensor.nodeId, nextCount);
  }
}
