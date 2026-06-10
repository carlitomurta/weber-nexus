import type { NewSensor, Sensor } from '@weber-nexus/repository';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { DEFAULT_WLCONFIG_TEMPLATE_XML } from './wlconfig-template';

const ATTRIBUTE_PREFIX = '@_';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  format: true,
  suppressEmptyNode: true,
});

export type WlConfigDocument = {
  configuration: Record<string, unknown>;
  [key: string]: unknown;
};

export type ParsedWlConfig = {
  readonly xml: string;
  readonly checksum: string;
  readonly document: WlConfigDocument;
  readonly sensors: Omit<NewSensor, 'controllerId'>[];
};

export class WlConfigXmlError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WlConfigXmlError';
  }
}

export function cleanWlConfigXml(raw: string): string {
  let cleaned = raw
    .replace(/\bEOF\b/g, '')
    .replace(/RSP1002\d+,[a-fA-F0-9]+,/gms, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const start = cleaned.indexOf('<?xml');

  if (start >= 0) {
    cleaned = cleaned.slice(start);
  }

  const endTag = '</configuration>';
  const end = cleaned.lastIndexOf(endTag);

  if (end >= 0) {
    cleaned = cleaned.slice(0, end + endTag.length);
  }

  return cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseWlConfigXml(xml: string): ParsedWlConfig {
  validateWlConfigXml(xml);

  const document = parser.parse(xml) as unknown;

  if (!isWlConfigDocument(document)) {
    throw new WlConfigXmlError(
      'WLConfig.xml não contém a raiz de configuração',
    );
  }

  return {
    xml,
    checksum: hashWlConfigXml(xml),
    document,
    sensors: sensorsFromWlConfigDocument(document),
  };
}

export function buildWlConfigXml(
  baseXml: string | null | undefined,
  sensors: ReadonlyArray<Sensor | NewSensor>,
): { xml: string; checksum: string } {
  const document = parseBaseWlConfigDocument(baseXml);
  const configuration = document.configuration;
  const { localRegisters, rules } = buildLocalRegistersAndRules(sensors);

  configuration.local_regs =
    localRegisters.length > 0 ? { reg: localRegisters } : {};
  configuration.rtu_read = rules.length > 0 ? { rule: rules } : {};

  const xml = builder.build(document).trim();

  validateWlConfigXml(xml);

  return {
    xml,
    checksum: hashWlConfigXml(xml),
  };
}

export function hashWlConfigXml(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('hex');
}

function validateWlConfigXml(xml: string): void {
  const validation = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  });

  if (validation !== true) {
    const detail = validation.err
      ? ` na linha ${validation.err.line}, coluna ${validation.err.col}: ${validation.err.msg}`
      : '';
    throw new WlConfigXmlError(`WLConfig.xml inválido${detail}`);
  }
}

function parseBaseWlConfigDocument(
  baseXml: string | null | undefined,
): WlConfigDocument {
  try {
    if (baseXml?.trim()) {
      return parseWlConfigXml(baseXml).document;
    }
  } catch {
    // Usa template seguro quando registros legados não possuem snapshot XML.
  }

  return parseWlConfigXml(DEFAULT_WLCONFIG_TEMPLATE_XML).document;
}

function sensorsFromWlConfigDocument(
  document: WlConfigDocument,
): Omit<NewSensor, 'controllerId'>[] {
  const localRegisters = indexedLocalRegisters(document);
  const rtuRead = asRecord(document.configuration.rtu_read);
  const rules = asArray(rtuRead?.rule);

  return rules
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

function buildLocalRegistersAndRules(
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

function toLocalRegisterXmlAttributes(
  register: Sensor['registers'][number],
  num: number,
): Record<string, string> {
  const attributes: Record<string, string> = {
    '@_cloudio': '1',
    '@_iot': '1',
    '@_lcd': '1',
    '@_logfiles': '8',
    '@_name': register.name,
    '@_num': String(num),
    '@_perms': '1',
  };

  if (!register.isHealthCheck && register.scaleType && register.scaleFactor) {
    attributes['@_scale_type'] = register.scaleType;
    attributes['@_scale_using'] = String(register.scaleFactor);
  }

  if (!register.isHealthCheck && register.unit?.trim()) {
    attributes['@_units'] = register.unit.trim();
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
    '@_count': String(count),
    '@_default': '0',
    '@_localreg': String(localreg),
    '@_mask': '0',
    '@_maxfail': '0',
    '@_name': name,
    '@_offset': '0',
    '@_poll': '1',
    '@_remfmt': 'int',
    '@_remreg': String(remreg),
    '@_remtype': 'hold_reg',
    '@_scale': '0',
    '@_swapped': '0',
    '@_unit': '1',
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

function readScaleType(
  source: Record<string, unknown> | undefined,
): 'multiply' | 'divide' | undefined {
  const value = readStringAttribute(source, 'scale_type');

  if (value === 'multiply' || value === 'divide') {
    return value;
  }

  return undefined;
}

function readStringAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = source?.[`${ATTRIBUTE_PREFIX}${name}`];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function readPositiveIntegerAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): number | undefined {
  const value = Number(readStringAttribute(source, name));

  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return undefined;
}

function readPositiveNumberAttribute(
  source: Record<string, unknown> | undefined,
  name: string,
): number | undefined {
  const value = Number(readStringAttribute(source, name));

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isWlConfigDocument(value: unknown): value is WlConfigDocument {
  return isRecord(value) && isRecord(value.configuration);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
