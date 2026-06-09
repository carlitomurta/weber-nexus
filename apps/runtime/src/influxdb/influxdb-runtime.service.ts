import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import {
  DEFAULT_INFLUXDB_AUTH_TOKEN,
  InfluxConfigsRepository,
} from '@weber-nexus/repository';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { RuntimeEnvService } from '../config/runtime-env.service';

type InfluxdbStatus = 'external' | 'started' | 'unavailable' | 'disabled';
const INFLUXDB_VERSION = '3.9.3';
const INFLUXDB_START_TIMEOUT_MS = 10_000;

@Injectable()
export class InfluxdbRuntimeService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('runtime/influxdb-runtime.service.ts');
  private child: ChildProcessWithoutNullStreams | undefined;
  private status: InfluxdbStatus = 'unavailable';

  constructor(
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly runtimeEnv: RuntimeEnvService,
  ) {}

  async onApplicationBootstrap() {
    await this.influxConfigsRepository.ensureDefault();
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
    if (this.runtimeEnv.isInfluxdbDisabled()) {
      this.status = 'disabled';
      this.logger.warn(
        'InfluxDB startup is disabled by NEXUS_DISABLE_INFLUXDB.',
      );
      return this.status;
    }

    const url = this.runtimeEnv.influxdbUrl();
    const token = await this.resolveAuthToken();

    if (await this.isInfluxdbReachable(url, token)) {
      await this.ensureConfiguredDatabase(url);
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
    const adminTokenFile = await this.ensureAdminTokenFile(dataDir);

    this.logger.info(`Starting InfluxDB from ${binaryPath}.`);
    this.logger.info(`InfluxDB data directory: ${dataDir}`);
    this.logger.info(`InfluxDB admin token file: ${adminTokenFile}`);

    this.child = spawn(
      binaryPath,
      [
        'serve',
        '--node-id',
        this.runtimeEnv.influxdbNodeId(),
        '--object-store',
        'file',
        '--data-dir',
        dataDir,
        '--http-bind',
        this.runtimeEnv.influxdbHttpBind(),
        '--admin-token-file',
        adminTokenFile,
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
    await this.waitForInfluxdb(url, token);
    await this.ensureConfiguredDatabase(url);
    return this.status;
  }

  private async isInfluxdbReachable(
    url: string,
    token: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await fetch(`${url}/health`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForInfluxdb(url: string, token: string): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < INFLUXDB_START_TIMEOUT_MS) {
      if (await this.isInfluxdbReachable(url, token)) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`InfluxDB did not become reachable at ${url}.`);
  }

  private async resolveAuthToken(): Promise<string> {
    const config = await this.influxConfigsRepository.ensureDefault();

    return config.token;
  }

  private async ensureConfiguredDatabase(url: string): Promise<void> {
    const config = await this.influxConfigsRepository.ensureDefault();
    const response = await fetch(
      new URL('/api/v3/configure/database', this.normalizeUrl(url)),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ db: config.bucket }),
      },
    );

    if (response.ok) {
      this.logger.info(`InfluxDB database is ready: ${config.bucket}`);
      return;
    }

    const responseText = await response.text();
    if (responseText.toLowerCase().includes('already exists')) {
      this.logger.info(`InfluxDB database already exists: ${config.bucket}`);
      return;
    }

    throw new Error(
      `InfluxDB database setup failed with status ${response.status}: ${responseText}`,
    );
  }

  private normalizeUrl(url: string): string {
    return url.endsWith('/') ? url : `${url}/`;
  }

  private resolveBinaryPath(): string | undefined {
    const binaryName =
      process.platform === 'win32' ? 'influxdb3.exe' : 'influxdb3';
    const platformDir = process.platform === 'win32' ? 'windows' : 'linux';
    const moduleDir = __dirname;
    const explicitPath = this.runtimeEnv.influxdbBinaryPath();
    const resourcesPath = this.runtimeEnv.resourcesPath();

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
        ...this.runtimeEnv.processEnv(),
        INFLUXDB3_AUTH_TOKEN: this.runtimeEnv.influxdbToken(
          DEFAULT_INFLUXDB_AUTH_TOKEN,
        ),
        PATH: [
          binaryDir,
          pythonDir,
          pythonDllDir,
          this.runtimeEnv.processPath(),
        ]
          .filter((value): value is string => Boolean(value))
          .join(';'),
        PYTHONHOME: existsSync(pythonDir)
          ? pythonDir
          : this.runtimeEnv.pythonHome(),
      };
    }

    return {
      ...this.runtimeEnv.processEnv(),
      INFLUXDB3_AUTH_TOKEN: this.runtimeEnv.influxdbToken(
        DEFAULT_INFLUXDB_AUTH_TOKEN,
      ),
      LD_LIBRARY_PATH: [
        binaryDir,
        pythonLibDir,
        this.runtimeEnv.ldLibraryPath(),
      ]
        .filter((value): value is string => Boolean(value))
        .join(':'),
      PYTHONHOME: existsSync(pythonDir)
        ? pythonDir
        : this.runtimeEnv.pythonHome(),
    };
  }

  private async resolveDataDir(): Promise<string> {
    const dataDir = this.runtimeEnv.influxdbDataDir();

    if (dataDir) {
      return this.ensureDataDir(dataDir);
    }

    const configuredDataDir = await this.readConfiguredDataDir();
    if (configuredDataDir) {
      return this.ensureDataDir(configuredDataDir);
    }

    if (process.platform === 'win32') {
      return this.ensureDataDir(
        path.join(
          this.runtimeEnv.localAppDataDir() ??
            path.join(homedir(), 'AppData', 'Local'),
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

    const appInstallDir = this.runtimeEnv.appInstallDir();
    if (appInstallDir) {
      return appInstallDir;
    }

    const resourcesPath = this.runtimeEnv.resourcesPath();
    if (resourcesPath) {
      return path.dirname(resourcesPath);
    }

    return process.cwd();
  }

  private async ensureDataDir(dataDir: string): Promise<string> {
    await mkdir(dataDir, { recursive: true });
    return dataDir;
  }

  private async ensureAdminTokenFile(dataDir: string): Promise<string> {
    const tokenFile = path.join(dataDir, 'admin-token.json');
    const token = this.runtimeEnv.influxdbToken(DEFAULT_INFLUXDB_AUTH_TOKEN);
    const tokenFileContent = `${JSON.stringify(
      {
        token,
        name: 'nexus-admin',
        description: 'Local Weber Nexus admin token',
      },
      null,
      2,
    )}\n`;

    await writeFile(tokenFile, tokenFileContent, { encoding: 'utf8' });

    if (process.platform !== 'win32') {
      await chmod(tokenFile, 0o600);
    }

    return tokenFile;
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
    const runtimeConfigPath = this.runtimeEnv.runtimeConfigPath();
    if (runtimeConfigPath) {
      return runtimeConfigPath;
    }

    if (process.platform === 'win32') {
      return path.join(
        this.runtimeEnv.roamingAppDataDir() ??
          path.join(homedir(), 'AppData', 'Roaming'),
        'Weber Nexus',
        'runtime-config.ini',
      );
    }

    return path.join(
      this.runtimeEnv.xdgConfigHome() ?? path.join(homedir(), '.config'),
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
