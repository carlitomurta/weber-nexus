jest.mock('@weber-nexus/repository', () => ({
  ControllersRepository: class {},
  SensorsRepository: class {},
}));
jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    error = jest.fn();
    info = jest.fn();
    warn = jest.fn();
  },
}));
jest.mock('../../polling/polling-runtime.service', () => ({
  PollingRuntimeService: class {},
}));

import type { Controller, NewController } from '@weber-nexus/repository';
import { ControllersService } from './controller.service';

describe('ControllersService XML sync behavior', () => {
  const controller: Controller = {
    id: 1,
    name: 'DXM',
    model: 'DXM1200',
    ipAddress: '192.168.1.10',
    site: null,
    port: 0,
    isMultihop: false,
    operationalStatus: 'active',
    pollingIntervalMs: 300000,
    xmlConfig: '<configuration />',
    xmlConfigChecksum: 'checksum',
    xmlLastSyncedAt: new Date('2026-06-10T00:00:00.000Z'),
    deletedAt: null,
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };

  let controllersRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    insertControllerWithSensors: jest.Mock;
    updateController: jest.Mock;
    updateControllerWithSensors: jest.Mock;
    deleteController: jest.Mock;
  };
  let sensorsRepository: {
    findByControllerId: jest.Mock;
    deleteByControllerId: jest.Mock;
  };
  let pollingRuntimeService: {
    refreshController: jest.Mock;
    stopController: jest.Mock;
  };
  let controllerXmlConfigService: {
    downloadControllerConfig: jest.Mock;
    toXmlMetadata: jest.Mock;
    uploadControllerConfig: jest.Mock;
    syncController: jest.Mock;
  };
  let service: ControllersService;

  beforeEach(() => {
    controllersRepository = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue(controller),
      insertControllerWithSensors: jest.fn().mockResolvedValue(controller),
      updateController: jest.fn().mockResolvedValue(controller),
      updateControllerWithSensors: jest.fn().mockResolvedValue(controller),
      deleteController: jest.fn(),
    };
    sensorsRepository = {
      findByControllerId: jest.fn().mockResolvedValue([]),
      deleteByControllerId: jest.fn(),
    };
    pollingRuntimeService = {
      refreshController: jest.fn(),
      stopController: jest.fn(),
    };
    controllerXmlConfigService = {
      downloadControllerConfig: jest.fn().mockResolvedValue({
        xml: '<configuration />',
        checksum: 'checksum',
        sensors: [{ name: 'Imported', nodeId: 1, registers: [] }],
      }),
      toXmlMetadata: jest.fn().mockReturnValue({
        xmlConfig: '<configuration />',
        xmlConfigChecksum: 'checksum',
        xmlLastSyncedAt: new Date('2026-06-10T00:00:00.000Z'),
      }),
      uploadControllerConfig: jest.fn().mockResolvedValue({
        xmlConfig: '<configuration />',
        xmlConfigChecksum: 'checksum',
        xmlLastSyncedAt: new Date('2026-06-10T00:00:00.000Z'),
      }),
      syncController: jest.fn().mockResolvedValue({ status: 'synced' }),
    };
    service = new ControllersService(
      controllersRepository as never,
      sensorsRepository as never,
      pollingRuntimeService as never,
      controllerXmlConfigService as never,
    );
  });

  it('downloads XML before creating a controller with imported sensors', async () => {
    const input: NewController = {
      name: 'DXM',
      model: 'DXM1200',
      ipAddress: '192.168.1.10',
      pollingIntervalMs: 300000,
    };

    await service.postController(input);

    expect(
      controllerXmlConfigService.downloadControllerConfig,
    ).toHaveBeenCalledWith('192.168.1.10');
    expect(
      controllersRepository.insertControllerWithSensors,
    ).toHaveBeenCalled();
  });

  it('rejects controller creation when XML download fails', async () => {
    controllerXmlConfigService.downloadControllerConfig.mockRejectedValue(
      new Error('Sem rede'),
    );

    await expect(
      service.postController({
        name: 'DXM',
        model: 'DXM1200',
        ipAddress: '192.168.1.10',
      }),
    ).rejects.toThrow('Sem rede');
    expect(
      controllersRepository.insertControllerWithSensors,
    ).not.toHaveBeenCalled();
  });

  it('updates a controller without XML sync when IP is unchanged', async () => {
    await service.updateController({
      ...controller,
      name: 'DXM Norte',
    });

    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).not.toHaveBeenCalled();
    expect(
      controllerXmlConfigService.downloadControllerConfig,
    ).not.toHaveBeenCalled();
    expect(controllersRepository.updateController).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DXM Norte',
        ipAddress: '192.168.1.10',
      }),
    );
  });

  it('pulls fresh XML and replaces sensors when controller IP changes', async () => {
    await service.updateController({
      ...controller,
      ipAddress: '192.168.1.11',
    });

    expect(
      controllerXmlConfigService.downloadControllerConfig,
    ).toHaveBeenCalledWith('192.168.1.11');
    expect(
      controllersRepository.updateControllerWithSensors,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '192.168.1.11',
        xmlConfigChecksum: 'checksum',
      }),
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Imported',
        }),
      ]),
    );
  });

  it('delegates manual sync to the XML service', async () => {
    await expect(service.syncControllerXml(1)).resolves.toEqual({
      status: 'synced',
    });
  });
});
