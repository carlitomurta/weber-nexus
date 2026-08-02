import { randomUUID } from 'node:crypto';
import { DEFAULT_WLCONFIG_TEMPLATE_XML } from './wlconfig-template';
import {
  ATTRIBUTE_PREFIX,
  WLCONFIG_FILENAME,
  ZERO_GUID,
  type WlConfigBuildOptions,
  type WlConfigDocument,
} from './wlconfig-xml.types';
import { asRecord, readStringAttribute } from './wlconfig-xml-record';

export function applyFileInfoMetadata(
  document: WlConfigDocument,
  options: WlConfigBuildOptions,
): void {
  const info = ensureFileInfo(document);
  const controllerModel = options.controllerModel?.trim();
  const currentGuid = readStringAttribute(info, 'guid');

  if (controllerModel) {
    info[`${ATTRIBUTE_PREFIX}device`] = controllerModel;
  }

  info[`${ATTRIBUTE_PREFIX}filename`] = WLCONFIG_FILENAME;

  if (!currentGuid || currentGuid === ZERO_GUID) {
    info[`${ATTRIBUTE_PREFIX}guid`] = options.guid ?? randomUUID();
  }

  info[`${ATTRIBUTE_PREFIX}timestamp`] = formatWlConfigTimestamp(
    options.now ?? new Date(),
  );
}

export function readFileInfo(
  document: WlConfigDocument,
): Record<string, unknown> | undefined {
  return asRecord(asRecord(document.configuration.file_info)?.info);
}

export function isSyntheticFileInfo(info: Record<string, unknown>): boolean {
  return (
    readStringAttribute(info, 'guid') === ZERO_GUID ||
    readStringAttribute(info, 'os') === 'Nexus' ||
    readStringAttribute(info, 'osversion') === 'Nexus' ||
    readStringAttribute(info, 'software') === 'Nexus'
  );
}

export function controllerModelFromWlConfigDocument(
  document: WlConfigDocument,
): string | undefined {
  return (
    readStringAttribute(readFileInfo(document), 'device')?.trim() || undefined
  );
}

export function formatWlConfigTimestamp(date: Date): string {
  const day = padDatePart(date.getUTCDate());
  const month = padDatePart(date.getUTCMonth() + 1);
  const year = date.getUTCFullYear();
  const hour = padDatePart(date.getUTCHours());
  const minute = padDatePart(date.getUTCMinutes());
  const second = padDatePart(date.getUTCSeconds());

  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

export function defaultWlConfigTemplateXml(): string {
  return DEFAULT_WLCONFIG_TEMPLATE_XML;
}

function ensureFileInfo(document: WlConfigDocument): Record<string, unknown> {
  let fileInfo = asRecord(document.configuration.file_info);

  if (fileInfo === undefined) {
    fileInfo = {};
    document.configuration.file_info = fileInfo;
  }

  let info = asRecord(fileInfo.info);

  if (info === undefined) {
    info = {};
    fileInfo.info = info;
  }

  return info;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}
