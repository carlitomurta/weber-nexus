import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import { InfluxConfigsRepository } from '@weber-nexus/repository';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { RuntimeEnvService } from '../config/runtime-env.service';
import { InfluxdbRuntimePathsService } from './influxdb-runtime-paths.service';

type InfluxdbStatus = 'external' | 'started' | 'unavailable' | 'disabled';
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
    private readonly runtimePaths: InfluxdbRuntimePathsService,
  ) {}

  async onApplicationBootstrap() {
    await this.influxConfigsRepository.ensureDefault();
    await this.ensureStarted();
  }

  onApplicationShutdown() {
    if (!this.child) return;

    this.logger.info('Parando processo gerenciado do InfluxDB...');
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
        'Inicialização do InfluxDB está desativada por NEXUS_DISABLE_INFLUXDB.',
      );
      return this.status;
    }

    const url = this.runtimeEnv.influxdbUrl();
    const token = await this.resolveAuthToken();

    if (await this.isInfluxdbReachable(url, token)) {
      await this.ensureConfiguredDatabase(url);
      this.status = 'external';
      this.logger.info(`InfluxDB já está em execução em ${url}.`);
      return this.status;
    }

    const binaryPath = this.runtimePaths.resolveBinaryPath();
    if (!binaryPath) {
      this.status = 'unavailable';
      this.logger.error('Binário do InfluxDB não foi encontrado.');
      return this.status;
    }

    const dataDir = await this.runtimePaths.resolveDataDir();
    const adminTokenFile =
      await this.runtimePaths.ensureAdminTokenFile(dataDir);

    this.logger.info(`Iniciando InfluxDB a partir de ${binaryPath}.`);
    this.logger.info(`Diretório de dados do InfluxDB: ${dataDir}`);
    this.logger.info(
      `Arquivo de token administrativo do InfluxDB: ${adminTokenFile}`,
    );

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
        env: this.runtimePaths.buildProcessEnv(binaryPath),
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
      this.logger.error('Processo do InfluxDB falhou ao iniciar.', error);
    });

    const managedChild = this.child;

    this.child.on('exit', (code, signal) => {
      if (this.child === managedChild) {
        this.child = undefined;
        this.status = 'unavailable';
      }

      this.logger.warn(
        `Processo do InfluxDB encerrou com código ${code ?? 'desconhecido'} e sinal ${
          signal ?? 'nenhum'
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

    throw new Error(`InfluxDB não ficou acessível em ${url}.`);
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
      this.logger.info(`Banco do InfluxDB está pronto: ${config.bucket}`);
      return;
    }

    const responseText = await response.text();
    if (responseText.toLowerCase().includes('already exists')) {
      this.logger.info(`Banco do InfluxDB já existe: ${config.bucket}`);
      return;
    }

    throw new Error(
      `Configuração do banco do InfluxDB falhou com status ${response.status}: ${responseText}`,
    );
  }

  private normalizeUrl(url: string): string {
    return url.endsWith('/') ? url : `${url}/`;
  }
}
