import type {
  PollingController,
  PollingSensor,
  PollingSensorRegister,
} from '@weber-nexus/polling-engine';
import type { Controller, Sensor } from '@weber-nexus/repository';

export function toPollingController(controller: Controller): PollingController {
  return {
    id: controller.id,
    name: controller.name,
    ipAddress: controller.ipAddress,
    pollingIntervalMs: controller.pollingIntervalMs,
    isMultihop: controller.isMultihop,
  };
}

export function toPollingSensors(sensors: Sensor[]): PollingSensor[] {
  return sensors.map((sensor) => ({
    id: sensor.id,
    controllerId: sensor.controllerId,
    nodeId: sensor.nodeId,
    name: sensor.name,
    registers: sensor.registers.map(toPollingRegister),
  }));
}

function toPollingRegister(
  register: Sensor['registers'][number],
): PollingSensorRegister {
  const legacyRegister = register as typeof register & {
    scale?: number;
  };
  const scaleType = register.isHealthCheck
    ? undefined
    : (register.scaleType ?? undefined);
  const scaleFactor = register.isHealthCheck
    ? undefined
    : (register.scaleFactor ?? legacyRegister.scale);

  return {
    name: register.name,
    address: register.address,
    scaleType,
    scaleFactor,
    unit: register.unit ?? '',
    isHealthCheck: register.isHealthCheck ?? undefined,
  };
}
