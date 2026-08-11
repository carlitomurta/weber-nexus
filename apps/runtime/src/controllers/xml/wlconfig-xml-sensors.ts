import type { NewSensor, Sensor } from '@weber-nexus/repository';
import {
  ATTRIBUTE_PREFIX,
  type WlConfigBuildOptions,
  type WlConfigParseOptions,
  type WlConfigDocument,
  WlConfigXmlError,
} from './wlconfig-xml.types';
import {
  asArray,
  asRecord,
  readPositiveIntegerAttribute,
  readPositiveNumberAttribute,
  readScaleType,
  readStringAttribute,
} from './wlconfig-xml-record';

export function sensorsFromWlConfigDocument(
  document: WlConfigDocument,
  options: WlConfigParseOptions = {},
): Omit<NewSensor, 'controllerId'>[] {
  const localRegisters = indexedLocalRegisters(document);
  const rtuRead = asRecord(document.configuration.rtu_read);
  const rules = asArray(rtuRead?.rule);
  const useMultihopNodeIds = shouldUseMultihopNodeIds(rules, options);

  const sensors = rules
    .map((rule): Omit<NewSensor, 'controllerId'> | undefined => {
      const count = readPositiveIntegerAttribute(rule, 'count');
      const localreg = readPositiveIntegerAttribute(rule, 'localreg');
      const remreg = readPositiveIntegerAttribute(rule, 'remreg');
      const name = readStringAttribute(rule, 'name') ?? `Sensor ${remreg}`;

      if (
        count === undefined ||
        localreg === undefined ||
        remreg === undefined
      ) {
        return undefined;
      }

      const registers = Array.from({ length: count }, (_, index) => {
        const localRegister = localRegisters.get(localreg + index);
        const unit = readStringAttribute(localRegister, 'units') ?? '';
        const scaleType = readScaleType(localRegister);
        const scaleFactor = readPositiveNumberAttribute(
          localRegister,
          'scale_using',
        );

        return {
          name:
            readStringAttribute(localRegister, 'name') ??
            `${name} ${index + 1}`,
          address: remreg + index,
          localRegisterNumber: localreg + index,
          scaleType,
          scaleFactor: scaleType === undefined ? undefined : scaleFactor,
          unit,
          isHealthCheck: !unit && scaleType === undefined,
        };
      });

      return {
        nodeId: nodeIdFromRule(rule, remreg, useMultihopNodeIds),
        name,
        description: null,
        model: null,
        location: null,
        operationalStatus: 'active',
        registers,
        deletedAt: null,
      };
    })
    .filter(
      (sensor): sensor is Omit<NewSensor, 'controllerId'> =>
        sensor !== undefined,
    );

  return mergeSensorsByName(sensors);
}

function nodeIdFromRule(
  rule: Record<string, unknown>,
  remreg: number,
  useMultihopNodeIds: boolean,
): number {
  if (useMultihopNodeIds) {
    return (
      readPositiveIntegerAttribute(rule, 'unit') ??
      Math.floor((remreg - 1) / 16)
    );
  }

  return Math.floor((remreg - 1) / 16);
}

function shouldUseMultihopNodeIds(
  rules: ReadonlyArray<Record<string, unknown>>,
  options: WlConfigParseOptions,
): boolean {
  if (options.isMultihop !== undefined && options.isMultihop !== null) {
    return options.isMultihop;
  }

  return rules.some(ruleUsesMultihopAddressing);
}

function ruleUsesMultihopAddressing(rule: Record<string, unknown>): boolean {
  const unit = readPositiveIntegerAttribute(rule, 'unit');
  const remreg = readPositiveIntegerAttribute(rule, 'remreg');
  const count = readPositiveIntegerAttribute(rule, 'count') ?? 1;

  if (unit === undefined || remreg === undefined) return false;

  const firstPerformanceRegister = unit * 16 + 1;
  const lastPerformanceRegister = unit * 16 + 16;
  const lastRuleRegister = remreg + count - 1;

  return (
    remreg < firstPerformanceRegister ||
    lastRuleRegister > lastPerformanceRegister
  );
}

export function assertSingleStatusRegisterPerNode(
  sensors: ReadonlyArray<Pick<Sensor | NewSensor, 'nodeId' | 'registers'>>,
): void {
  const statusCountsByNodeId = new Map<number, number>();

  for (const sensor of sensors) {
    const statusCount = sensor.registers.filter(
      (register) => register.isHealthCheck === true,
    ).length;

    if (statusCount === 0) continue;

    const nextCount =
      (statusCountsByNodeId.get(sensor.nodeId) ?? 0) + statusCount;

    if (nextCount > 1) {
      throw new WlConfigXmlError(
        `Nó ${sensor.nodeId} deve ter apenas um registrador de status`,
      );
    }

    statusCountsByNodeId.set(sensor.nodeId, nextCount);
  }
}

export function buildLocalRegistersAndRules(
  sensors: ReadonlyArray<Sensor | NewSensor>,
  options: WlConfigBuildOptions = {},
): {
  localRegisters: Record<string, string>[];
  rules: Record<string, string>[];
} {
  const localRegisters: Record<string, string>[] = [];
  const rules: Record<string, string>[] = [];
  const localRegisterBySensorRegister = new Map<string, number>();

  const orderedSensors = [...sensors].sort((a, b) => {
    if (a.nodeId !== b.nodeId) return a.nodeId - b.nodeId;
    return a.name.localeCompare(b.name);
  });

  for (const sensor of orderedSensors) {
    const orderedRegisters = [...sensor.registers].sort(
      (a, b) => a.address - b.address,
    );

    for (const register of orderedRegisters) {
      const num = localRegisters.length + 1;
      localRegisterBySensorRegister.set(
        sensorRegisterKey(sensor, register),
        num,
      );
      localRegisters.push(toLocalRegisterXmlAttributes(register, num));
    }

    for (const group of contiguousRegisterGroups(orderedRegisters)) {
      const firstRegister = group[0];
      const localreg = localRegisterBySensorRegister.get(
        sensorRegisterKey(sensor, firstRegister),
      );

      if (localreg === undefined) continue;

      rules.push(
        toRtuReadRuleXmlAttributes(
          sensor.name,
          firstRegister.address,
          group.length,
          localreg,
          options.isMultihop === true ? sensor.nodeId : 1,
        ),
      );
    }
  }

  return { localRegisters, rules };
}

function mergeSensorsByName(
  sensors: ReadonlyArray<Omit<NewSensor, 'controllerId'>>,
): Omit<NewSensor, 'controllerId'>[] {
  const sensorsByName = new Map<string, Omit<NewSensor, 'controllerId'>>();

  for (const sensor of sensors) {
    const existingSensor = sensorsByName.get(sensor.name);

    if (!existingSensor) {
      sensorsByName.set(sensor.name, {
        ...sensor,
        registers: [...sensor.registers],
      });
      continue;
    }

    sensorsByName.set(sensor.name, {
      ...existingSensor,
      registers: [...existingSensor.registers, ...sensor.registers].sort(
        compareRegistersByAddress,
      ),
    });
  }

  return [...sensorsByName.values()];
}

function indexedLocalRegisters(
  document: WlConfigDocument,
): Map<number, Record<string, unknown>> {
  const localRegs = asRecord(document.configuration.local_regs);
  const registers = asArray(localRegs?.reg);
  const indexed = new Map<number, Record<string, unknown>>();

  for (const register of registers) {
    const num = readPositiveIntegerAttribute(register, 'num');

    if (num !== undefined) {
      indexed.set(num, register);
    }
  }

  return indexed;
}

function toLocalRegisterXmlAttributes(
  register: Sensor['registers'][number],
  num: number,
): Record<string, string> {
  const attributes: Record<string, string> = {
    [`${ATTRIBUTE_PREFIX}cloudio`]: '1',
    [`${ATTRIBUTE_PREFIX}iot`]: '1',
    [`${ATTRIBUTE_PREFIX}lcd`]: '1',
    [`${ATTRIBUTE_PREFIX}logfiles`]: '8',
    [`${ATTRIBUTE_PREFIX}name`]: register.name,
    [`${ATTRIBUTE_PREFIX}num`]: String(num),
    [`${ATTRIBUTE_PREFIX}perms`]: '1',
  };

  if (!register.isHealthCheck && register.scaleType && register.scaleFactor) {
    attributes[`${ATTRIBUTE_PREFIX}scale_type`] = register.scaleType;
    attributes[`${ATTRIBUTE_PREFIX}scale_using`] = String(register.scaleFactor);
  }

  if (!register.isHealthCheck && register.unit?.trim()) {
    attributes[`${ATTRIBUTE_PREFIX}units`] = register.unit.trim();
  }

  return attributes;
}

function toRtuReadRuleXmlAttributes(
  name: string,
  remreg: number,
  count: number,
  localreg: number,
  unit: number,
): Record<string, string> {
  return {
    [`${ATTRIBUTE_PREFIX}count`]: String(count),
    [`${ATTRIBUTE_PREFIX}default`]: '0',
    [`${ATTRIBUTE_PREFIX}localreg`]: String(localreg),
    [`${ATTRIBUTE_PREFIX}mask`]: '0',
    [`${ATTRIBUTE_PREFIX}maxfail`]: '0',
    [`${ATTRIBUTE_PREFIX}name`]: name,
    [`${ATTRIBUTE_PREFIX}offset`]: '0',
    [`${ATTRIBUTE_PREFIX}poll`]: '1',
    [`${ATTRIBUTE_PREFIX}remfmt`]: 'int',
    [`${ATTRIBUTE_PREFIX}remreg`]: String(remreg),
    [`${ATTRIBUTE_PREFIX}remtype`]: 'hold_reg',
    [`${ATTRIBUTE_PREFIX}scale`]: '0',
    [`${ATTRIBUTE_PREFIX}swapped`]: '0',
    [`${ATTRIBUTE_PREFIX}unit`]: String(unit),
  };
}

function contiguousRegisterGroups<T extends { address: number }>(
  registers: ReadonlyArray<T>,
): T[][] {
  const groups: T[][] = [];

  for (const register of registers) {
    const lastGroup = groups.at(-1);
    const lastRegister = lastGroup?.at(-1);

    if (
      lastGroup &&
      lastRegister &&
      register.address === lastRegister.address + 1
    ) {
      lastGroup.push(register);
    } else {
      groups.push([register]);
    }
  }

  return groups;
}

function sensorRegisterKey(
  sensor: Pick<Sensor | NewSensor, 'name' | 'nodeId'>,
  register: Pick<Sensor['registers'][number], 'address' | 'name'>,
): string {
  return `${sensor.nodeId}:${sensor.name}:${register.address}:${register.name}`;
}

function compareRegistersByAddress(
  left: NewSensor['registers'][number],
  right: NewSensor['registers'][number],
): number {
  return left.address - right.address;
}
