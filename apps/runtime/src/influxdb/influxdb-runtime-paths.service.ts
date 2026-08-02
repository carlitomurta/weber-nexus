import { Injectable } from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import { DEFAULT_INFLUXDB_AUTH_TOKEN } from '@weber-nexus/repository';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { RuntimeEnvService } from '../config/runtime-env.service';

const INFLUXDB_VERSION = '3.9.3';

@Injectable()
export class InfluxdbRuntimePathsService {
  private readonly logger = new Logger(
    'runtime/influxdb/influxdb-runtime-paths.service.ts',
  );

  constructor(private readonly runtimeEnv: RuntimeEnvService) {}

  resolveBinaryPath(): string | undefined {
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

  buildProcessEnv(binaryPath: string): NodeJS.ProcessEnv {
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

  async resolveDataDir(): Promise<string> {
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

  async ensureAdminTokenFile(dataDir: string): Promise<string> {
    const tokenFile = path.join(dataDir, 'admin-token.json');
    const token = this.runtimeEnv.influxdbToken(DEFAULT_INFLUXDB_AUTH_TOKEN);
    const tokenFileContent = `${JSON.stringify(
      {
        token,
        name: 'nexus-admin',
        description: 'Token administrativo local do Weber Nexus',
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
          `Diretório de dados do InfluxDB não tem permissão de escrita: ${candidate}`,
          error,
        );
      }
    }

    throw new Error(
      'Nenhum diretório de dados gravável do InfluxDB foi encontrado.',
    );
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
