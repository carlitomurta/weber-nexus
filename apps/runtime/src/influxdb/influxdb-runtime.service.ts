import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

type InfluxdbStatus = 'external' | 'started' | 'unavailable' | 'disabled';
const DEFAULT_INFLUXDB_URL = 'http://127.0.0.1:8181';
const DEFAULT_HTTP_BIND = '127.0.0.1:8181';
const INFLUXDB_VERSION = '3.9.3';

@Injectable()
export class InfluxdbRuntimeService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('runtime/influxdb-runtime.service.ts');
  private child: ChildProcessWithoutNullStreams | undefined;
  private status: InfluxdbStatus = 'unavailable';

  async onApplicationBootstrap() {
    await this.ensureStarted();
  }

  onApplicationShutdown() {
    if (!this.child) return;

    this.logger.info('Stopping managed InfluxDB process...');
    this.child.kill();
    this.child = undefined;
  }

  getStatus(): InfluxdbStatus {
    return this.status;
  }

  async ensureStarted(): Promise<InfluxdbStatus> {
    if (process.env.NEXUS_DISABLE_INFLUXDB === '1') {
      this.status = 'disabled';
      this.logger.warn(
        'InfluxDB startup is disabled by NEXUS_DISABLE_INFLUXDB.',
      );
      return this.status;
    }

    const url = process.env.NEXUS_INFLUXDB_URL ?? DEFAULT_INFLUXDB_URL;

    if (await this.isInfluxdbReachable(url)) {
      this.status = 'external';
      this.logger.info(`InfluxDB is already running at ${url}.`);
      return this.status;
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      this.status = 'unavailable';
      this.logger.error('InfluxDB binary was not found.');
      return this.status;
    }

    const dataDir = await this.resolveDataDir();

    this.logger.info(`Starting InfluxDB from ${binaryPath}.`);
    this.logger.info(`InfluxDB data directory: ${dataDir}`);

    this.child = spawn(
      binaryPath,
      [
        'serve',
        '--node-id',
        process.env.NEXUS_INFLUXDB_NODE_ID ?? 'nexus-local',
        '--object-store',
        'file',
        '--data-dir',
        dataDir,
        '--http-bind',
        process.env.NEXUS_INFLUXDB_HTTP_BIND ?? DEFAULT_HTTP_BIND,
      ],
      {
        env: this.buildProcessEnv(binaryPath),
        stdio: 'pipe',
        windowsHide: true,
      },
    );

    this.child.stdout.on('data', (chunk) => {
      this.logger.info(String(chunk).trim());
    });

    this.child.stderr.on('data', (chunk) => {
      this.logger.warn(String(chunk).trim());
    });

    this.child.on('error', (error) => {
      this.status = 'unavailable';
      this.logger.error('InfluxDB process failed to start.', error);
    });

    const managedChild = this.child;

    this.child.on('exit', (code, signal) => {
      if (this.child === managedChild) {
        this.child = undefined;
        this.status = 'unavailable';
      }

      this.logger.warn(
        `InfluxDB process exited with code ${code ?? 'unknown'} and signal ${
          signal ?? 'none'
        }.`,
      );
    });

    this.status = 'started';
    return this.status;
  }

  private async isInfluxdbReachable(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveBinaryPath(): string | undefined {
    const binaryName =
      process.platform === 'win32' ? 'influxdb3.exe' : 'influxdb3';
    const platformDir = process.platform === 'win32' ? 'windows' : 'linux';
    const moduleDir = __dirname;
    const explicitPath = process.env.NEXUS_INFLUXDB_BINARY_PATH;
    const resourcesPath = process.env.NEXUS_RESOURCES_PATH;

    const candidates = [
      explicitPath,
      resourcesPath
        ? path.join(resourcesPath, 'influxdb', binaryName)
        : undefined,
      path.join(
        process.cwd(),
        'resources',
        'influxdb',
        INFLUXDB_VERSION,
        platformDir,
        binaryName,
      ),
      path.join(
        process.cwd(),
        '..',
        '..',
        'resources',
        'influxdb',
        INFLUXDB_VERSION,
        platformDir,
        binaryName,
      ),
      path.join(
        moduleDir,
        '..',
        '..',
        '..',
        '..',
        'resources',
        'influxdb',
        INFLUXDB_VERSION,
        platformDir,
        binaryName,
      ),
    ].filter((candidate): candidate is string => Boolean(candidate));

    return candidates.find((candidate) => existsSync(candidate));
  }

  private buildProcessEnv(binaryPath: string): NodeJS.ProcessEnv {
    const binaryDir = path.dirname(binaryPath);
    const pythonDir = path.join(binaryDir, 'python');
    const pythonLibDir = path.join(pythonDir, 'lib');
    const pythonDllDir = path.join(pythonDir, 'DLLs');

    if (process.platform === 'win32') {
      return {
        ...process.env,
        PATH: [binaryDir, pythonDir, pythonDllDir, process.env.PATH]
          .filter((value): value is string => Boolean(value))
          .join(';'),
        PYTHONHOME: existsSync(pythonDir) ? pythonDir : process.env.PYTHONHOME,
      };
    }

    return {
      ...process.env,
      LD_LIBRARY_PATH: [binaryDir, pythonLibDir, process.env.LD_LIBRARY_PATH]
        .filter((value): value is string => Boolean(value))
        .join(':'),
      PYTHONHOME: existsSync(pythonDir) ? pythonDir : process.env.PYTHONHOME,
    };
  }

  private async resolveDataDir(): Promise<string> {
    if (process.env.NEXUS_INFLUXDB_DATA_DIR) {
      return this.ensureDataDir(process.env.NEXUS_INFLUXDB_DATA_DIR);
    }

    const configuredDataDir = await this.readConfiguredDataDir();
    if (configuredDataDir) {
      return this.ensureDataDir(configuredDataDir);
    }

    if (process.platform === 'win32') {
      return this.ensureDataDir(
        path.join(
          process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'),
          'Weber Nexus',
          'influxdb',
        ),
      );
    }

    return this.resolveLinuxDefaultDataDir();
  }

  private async resolveLinuxDefaultDataDir(): Promise<string> {
    const appInstallDir = this.resolveLinuxAppInstallDir();
    const candidates = [
      appInstallDir ? path.join(appInstallDir, 'influxdb-data') : undefined,
      path.join(homedir(), '.local', 'share', 'weber-nexus', 'influxdb'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        return await this.ensureDataDir(candidate);
      } catch (error) {
        this.logger.warn(
          `InfluxDB data directory is not writable: ${candidate}`,
          error,
        );
      }
    }

    throw new Error('No writable InfluxDB data directory was found.');
  }

  private resolveLinuxAppInstallDir(): string | undefined {
    if (process.platform !== 'linux') {
      return undefined;
    }

    if (process.env.NEXUS_APP_INSTALL_DIR) {
      return process.env.NEXUS_APP_INSTALL_DIR;
    }

    if (process.env.NEXUS_RESOURCES_PATH) {
      return path.dirname(process.env.NEXUS_RESOURCES_PATH);
    }

    return process.cwd();
  }

  private async ensureDataDir(dataDir: string): Promise<string> {
    await mkdir(dataDir, { recursive: true });
    return dataDir;
  }

  private async readConfiguredDataDir(): Promise<string | undefined> {
    const configPath = this.resolveRuntimeConfigPath();

    try {
      const config = await readFile(configPath, 'utf8');
      const configuredDataDir = this.readIniValue(
        config,
        'influxdb',
        'dataDir',
      );

      return configuredDataDir && configuredDataDir.trim().length > 0
        ? configuredDataDir
        : undefined;
    } catch {
      return undefined;
    }
  }

  private resolveRuntimeConfigPath(): string {
    if (process.env.NEXUS_RUNTIME_CONFIG_PATH) {
      return process.env.NEXUS_RUNTIME_CONFIG_PATH;
    }

    if (process.platform === 'win32') {
      return path.join(
        process.env.APPDATA ?? path.join(homedir(), 'AppData', 'Roaming'),
        'Weber Nexus',
        'runtime-config.ini',
      );
    }

    return path.join(
      process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'),
      'weber-nexus',
      'runtime-config.ini',
    );
  }

  private readIniValue(
    content: string,
    sectionName: string,
    keyName: string,
  ): string | undefined {
    let currentSection: string | undefined;

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith(';') || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1).trim();
        continue;
      }

      if (currentSection !== sectionName) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (key !== keyName) {
        continue;
      }

      return line.slice(separatorIndex + 1).trim();
    }

    return undefined;
  }
}
