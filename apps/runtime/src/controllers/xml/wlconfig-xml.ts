/* eslint-disable no-control-regex */
import type { NewSensor, Sensor } from '@weber-nexus/repository';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import {
  applyFileInfoMetadata,
  controllerModelFromWlConfigDocument,
  defaultWlConfigTemplateXml,
  formatWlConfigTimestamp,
  isSyntheticFileInfo,
  readFileInfo,
} from './wlconfig-xml-metadata';
import { isWlConfigDocument } from './wlconfig-xml-record';
import {
  assertSingleStatusRegisterPerNode,
  buildLocalRegistersAndRules,
  sensorsFromWlConfigDocument,
} from './wlconfig-xml-sensors';
import {
  ATTRIBUTE_PREFIX,
  WlConfigXmlError,
  type ParsedWlConfig,
  type WlConfigBuildOptions,
  type WlConfigDocument,
} from './wlconfig-xml.types';

export {
  WlConfigXmlError,
  type ParsedWlConfig,
  type WlConfigBuildOptions,
  type WlConfigDocument,
};
export {
  defaultWlConfigTemplateXml,
  formatWlConfigTimestamp,
} from './wlconfig-xml-metadata';

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

export function cleanWlConfigXml(raw: string): string {
  let cleaned = raw
    .replace(/\bEOF\b/g, '')
    .replace(/RSP1002\d+,[a-fA-F0-9]+,/gms, '')
    .replace(/\x1E/g, '\r')
    .replace(/\x1F/g, '\n')
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

  const sensors = sensorsFromWlConfigDocument(document);

  assertSingleStatusRegisterPerNode(sensors);

  return {
    xml,
    checksum: hashWlConfigXml(xml),
    document,
    controllerModel: controllerModelFromWlConfigDocument(document),
    sensors,
  };
}

export function buildWlConfigXml(
  baseXml: string | null | undefined,
  sensors: ReadonlyArray<Sensor | NewSensor>,
  options: WlConfigBuildOptions = {},
): { xml: string; checksum: string } {
  assertSingleStatusRegisterPerNode(sensors);

  const document = parseBaseWlConfigDocument(baseXml);
  const configuration = document.configuration;
  const { localRegisters, rules } = buildLocalRegistersAndRules(sensors);

  applyFileInfoMetadata(document, options);

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

export function hasWlConfigFileInfo(xml: string | null | undefined): boolean {
  try {
    return xml?.trim()
      ? readFileInfo(parseWlConfigXml(xml).document) !== undefined
      : false;
  } catch {
    return false;
  }
}

export function hasReusableWlConfigFileInfo(
  xml: string | null | undefined,
): boolean {
  try {
    if (!xml?.trim()) return false;

    const info = readFileInfo(parseWlConfigXml(xml).document);

    return info !== undefined && !isSyntheticFileInfo(info);
  } catch {
    return false;
  }
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

  return parseWlConfigXml(defaultWlConfigTemplateXml()).document;
}
