import type { NewSensor } from '@weber-nexus/repository';

export const ATTRIBUTE_PREFIX = '@_';
export const WLCONFIG_FILENAME = 'WLConfig.xml';
export const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

export type WlConfigDocument = {
  configuration: Record<string, unknown>;
  [key: string]: unknown;
};

export type ParsedWlConfig = {
  readonly xml: string;
  readonly checksum: string;
  readonly document: WlConfigDocument;
  readonly controllerModel?: string;
  readonly sensors: Omit<NewSensor, 'controllerId'>[];
};

export type WlConfigBuildOptions = {
  readonly controllerModel?: string;
  readonly guid?: string;
  readonly now?: Date;
};

export class WlConfigXmlError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WlConfigXmlError';
  }
}
