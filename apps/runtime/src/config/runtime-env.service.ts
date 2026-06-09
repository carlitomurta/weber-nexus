import { Injectable } from '@nestjs/common';

export const DEFAULT_RUNTIME_HOST = '127.0.0.1';
export const DEFAULT_RUNTIME_PORT = 3000;
export const DEFAULT_INFLUXDB_URL = 'http://127.0.0.1:8181';
export const DEFAULT_INFLUXDB_HTTP_BIND = '127.0.0.1:8181';
export const DEFAULT_INFLUXDB_NODE_ID = 'nexus-local';

@Injectable()
export class RuntimeEnvService {
  runtimeHost(): string {
    return DEFAULT_RUNTIME_HOST;
  }

  runtimePort(): number {
    const port = Number(process.env.PORT);

    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      return port;
    }

    return DEFAULT_RUNTIME_PORT;
  }

  isInfluxdbDisabled(): boolean {
    return process.env.NEXUS_DISABLE_INFLUXDB === '1';
  }

  influxdbUrl(): string {
    return process.env.NEXUS_INFLUXDB_URL ?? DEFAULT_INFLUXDB_URL;
  }

  influxdbNodeId(): string {
    return process.env.NEXUS_INFLUXDB_NODE_ID ?? DEFAULT_INFLUXDB_NODE_ID;
  }

  influxdbHttpBind(): string {
    return process.env.NEXUS_INFLUXDB_HTTP_BIND ?? DEFAULT_INFLUXDB_HTTP_BIND;
  }

  influxdbBinaryPath(): string | undefined {
    return process.env.NEXUS_INFLUXDB_BINARY_PATH;
  }

  resourcesPath(): string | undefined {
    return process.env.NEXUS_RESOURCES_PATH;
  }

  influxdbToken(defaultToken: string): string {
    return (
      process.env.NEXUS_INFLUXDB_TOKEN ??
      process.env.INFLUXDB3_AUTH_TOKEN ??
      defaultToken
    );
  }

  influxdbDataDir(): string | undefined {
    return process.env.NEXUS_INFLUXDB_DATA_DIR;
  }

  appInstallDir(): string | undefined {
    return process.env.NEXUS_APP_INSTALL_DIR;
  }

  runtimeConfigPath(): string | undefined {
    return process.env.NEXUS_RUNTIME_CONFIG_PATH;
  }

  localAppDataDir(): string | undefined {
    return process.env.LOCALAPPDATA;
  }

  roamingAppDataDir(): string | undefined {
    return process.env.APPDATA;
  }

  xdgConfigHome(): string | undefined {
    return process.env.XDG_CONFIG_HOME;
  }

  processEnv(): NodeJS.ProcessEnv {
    return process.env;
  }

  processPath(): string | undefined {
    return process.env.PATH;
  }

  ldLibraryPath(): string | undefined {
    return process.env.LD_LIBRARY_PATH;
  }

  pythonHome(): string | undefined {
    return process.env.PYTHONHOME;
  }
}
