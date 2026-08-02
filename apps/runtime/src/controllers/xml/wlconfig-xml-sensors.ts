import type { NewSensor, Sensor } from '@weber-nexus/repository';
import {
  ATTRIBUTE_PREFIX,
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
): Omit<NewSensor, 'controllerId'>[] {
  const localRegisters = indexedLocalRegisters(document);
  const rtuRead = asRecord(document.configuration.rtu_read);
  const rules = asArray(rtuRead?.rule);

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
        nodeId: Math.floor((remreg - 1) / 16),
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
    [`${ATTRIBUTE_PREFIX}unit`]: '1',
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
