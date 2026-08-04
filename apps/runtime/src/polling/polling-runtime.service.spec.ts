jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    error = jest.fn();
    info = jest.fn();
    warn = jest.fn();
  },
}));
jest.mock('@weber-nexus/polling-engine', () => ({
  PollingEngine: class {
    startController = jest.fn();
    stop = jest.fn();
    stopController = jest.fn();
  },
}));
jest.mock('@weber-nexus/repository', () => ({
  ControllersRepository: class {},
  SensorsRepository: class {},
}));

import type { ControllerPollingResult } from '@weber-nexus/polling-engine';
import { PollingRuntimeService } from './polling-runtime.service';

describe('PollingRuntimeService status updates', () => {
  let controllersRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    updateOperationalStatus: jest.Mock;
  };
  let sensorsRepository: {
    findByControllerId: jest.Mock;
    updateOperationalStatusByControllerId: jest.Mock;
  };
  let telemetryService: { writePollingResult: jest.Mock };
  let runtimeEnv: { isRuntimeMaintenanceEnabled: jest.Mock };
  let service: PollingRuntimeService;

  beforeEach(() => {
    controllersRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      updateOperationalStatus: jest.fn().mockResolvedValue(undefined),
    };
    sensorsRepository = {
      findByControllerId: jest.fn().mockResolvedValue([]),
      updateOperationalStatusByControllerId: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    telemetryService = {
      writePollingResult: jest.fn().mockResolvedValue(undefined),
    };
    runtimeEnv = {
      isRuntimeMaintenanceEnabled: jest.fn().mockReturnValue(false),
    };
    service = new PollingRuntimeService(
      controllersRepository as never,
      sensorsRepository as never,
      telemetryService as never,
      runtimeEnv as never,
    );
  });

  it('marks controller and sensors active after a successful poll', async () => {
    await callHandlePollingResult(service, pollingResult());

    expect(controllersRepository.updateOperationalStatus).toHaveBeenCalledWith(
      1,
      'active',
    );
    expect(
      sensorsRepository.updateOperationalStatusByControllerId,
    ).toHaveBeenCalledWith(1, 'active');
  });

  it('marks controller and sensors offline after a polling failure', async () => {
    await callHandlePollingError(
      service,
      new Error('timeout'),
      pollingResult().controller,
    );

    expect(controllersRepository.updateOperationalStatus).toHaveBeenCalledWith(
      1,
      'offline',
    );
    expect(
      sensorsRepository.updateOperationalStatusByControllerId,
    ).toHaveBeenCalledWith(1, 'offline');
  });

  it('does not refresh controller while polling is paused for update', async () => {
    service.pauseForUpdate();

    await service.refreshController(1);

    expect(controllersRepository.findById).not.toHaveBeenCalled();
  });
});

function callHandlePollingResult(
  service: PollingRuntimeService,
  result: ControllerPollingResult,
): Promise<void> {
  return (
    service as unknown as {
      handlePollingResult(result: ControllerPollingResult): Promise<void>;
    }
  ).handlePollingResult(result);
}

function callHandlePollingError(
  service: PollingRuntimeService,
  error: Error,
  controller: ControllerPollingResult['controller'],
): Promise<void> {
  return (
    service as unknown as {
      handlePollingError(
        error: Error,
        controller: ControllerPollingResult['controller'],
      ): Promise<void>;
    }
  ).handlePollingError(error, controller);
}

function pollingResult(): ControllerPollingResult {
  return {
    controller: {
      id: 1,
      name: 'DXM Norte',
      ipAddress: '192.168.1.10',
      pollingIntervalMs: 300000,
      protocol: 'host-api',
    },
    results: [],
    polledAt: new Date('2026-06-10T00:00:00.000Z'),
  };
}
