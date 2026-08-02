export const WLCONFIG_FILENAME = 'WLConfig.xml';
export const CONTROLLER_API_PORT = 8844;
export const MAX_CHUNK_BYTES = 512;
export const DEFAULT_TIMEOUT_MS = 10000;
export const CONTROLLER_RESET_COMMAND = 'CMD0200\n\r';

export type ControllerFileTransferOptions = {
  readonly host: string;
  readonly port?: number;
  readonly timeoutMs?: number;
};

export type WlConfigUploadPlan = {
  readonly fileSizeBytes: number;
  readonly chunkCount: number;
  readonly chunkSizes: readonly number[];
  readonly totalChunkBytes: number;
};
