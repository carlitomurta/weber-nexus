import type {
  SensorRegister,
  CreateSensorInput,
} from "../../../types/sensors.type";
import type { SensorDraft } from "./types";

export function buildSensorPayload(
  draft: SensorDraft,
  controllerId: number,
): CreateSensorInput | { error: string } {
  if (!draft.name.trim()) {
    return { error: "Informe o nome do sensor." };
  }

  if (!Number.isInteger(draft.nodeId) || draft.nodeId <= 0) {
    return { error: "Informe um Node ID válido." };
  }

  if (draft.registers.length === 0) {
    return { error: "Informe ao menos um registro do sensor." };
  }

  const firstAddress = firstNodeRegisterAddress(draft.nodeId);
  const lastAddress = lastNodeRegisterAddress(draft.nodeId);
  const invalidRegister = draft.registers.find(
    (register) =>
      !register.name.trim() ||
      !Number.isInteger(register.address) ||
      register.address < firstAddress ||
      register.address > lastAddress ||
      !isScaleType(register.scaleType) ||
      !Number.isFinite(register.scaleFactor) ||
      register.scaleFactor <= 0 ||
      !register.unit.trim(),
  );

  if (invalidRegister) {
    return {
      error: `Registros do Node ${draft.nodeId} devem ficar entre ${firstAddress} e ${lastAddress}.`,
    };
  }

  return {
    controllerId,
    nodeId: draft.nodeId,
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    location: draft.location?.trim() || null,
    model: draft.model?.trim() || null,
    registers: draft.registers.map((register) => ({
      name: register.name.trim(),
      address: register.address,
      scaleType: register.scaleType,
      scaleFactor: register.scaleFactor,
      unit: register.unit.trim(),
    })),
  };
}

export function firstNodeRegisterAddress(nodeId: number) {
  return nodeId * 16 + 1;
}

export function lastNodeRegisterAddress(nodeId: number) {
  return nodeId * 16 + 16;
}

export function nextRegisterAddress(
  nodeId: number,
  registers: SensorRegister[],
) {
  const firstAddress = firstNodeRegisterAddress(nodeId);
  const usedAddresses = new Set(registers.map((register) => register.address));

  for (
    let address = firstAddress;
    address <= lastNodeRegisterAddress(nodeId);
    address += 1
  ) {
    if (!usedAddresses.has(address)) return address;
  }

  return firstAddress;
}

export function normalizeSensorRegister(
  register: SensorRegister,
): SensorRegister {
  const legacyRegister = register as SensorRegister & { scale?: number };

  return {
    name: register.name,
    address: register.address,
    scaleType: register.scaleType ?? "multiply",
    scaleFactor: register.scaleFactor ?? legacyRegister.scale ?? 1,
    unit: register.unit,
  };
}

function isScaleType(value: string): value is SensorRegister["scaleType"] {
  return value === "multiply" || value === "divide";
}
