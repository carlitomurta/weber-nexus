export type ElectronApi = {
  app: {
    getVersion(): Promise<string>;
    updateTitle(title: string): void;
  };

  ipc: {
    send(channel: string, data?: unknown): void;

    on(channel: string, callback: (...args: unknown[]) => void): void;

    off(channel: string, callback: (...args: unknown[]) => void): void;

    invoke(channel: string, data?: unknown): Promise<unknown>;
  };
};
