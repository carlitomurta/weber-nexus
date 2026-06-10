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

import type { Controller, NewSensor } from '@weber-nexus/repository';
import { SensorsService } from './sensors.service';

describe('SensorsService XML upload gate', () => {
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
    findById: jest.Mock;
    updateXmlSyncMetadata: jest.Mock;
  };
  let sensorsRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByControllerId: jest.Mock;
    findConflictingNodeId: jest.Mock;
    insertSensor: jest.Mock;
    updateSensor: jest.Mock;
    deleteSensor: jest.Mock;
  };
  let pollingRuntimeService: { refreshController: jest.Mock };
  let controllerXmlConfigService: { uploadControllerConfig: jest.Mock };
  let service: SensorsService;

  beforeEach(() => {
    controllersRepository = {
      findById: jest.fn().mockResolvedValue(controller),
      updateXmlSyncMetadata: jest.fn(),
    };
    sensorsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByControllerId: jest.fn().mockResolvedValue([]),
      findConflictingNodeId: jest.fn().mockResolvedValue(undefined),
      insertSensor: jest.fn(),
      updateSensor: jest.fn(),
      deleteSensor: jest.fn(),
    };
    pollingRuntimeService = { refreshController: jest.fn() };
    controllerXmlConfigService = {
      uploadControllerConfig: jest
        .fn()
        .mockRejectedValue(new Error('Falha no envio')),
    };
    service = new SensorsService(
      controllersRepository as never,
      sensorsRepository as never,
      pollingRuntimeService as never,
      controllerXmlConfigService as never,
    );
  });

  it('does not persist a sensor when XML upload fails', async () => {
    const sensor: NewSensor = {
      controllerId: 1,
      nodeId: 2,
      name: 'Pump',
      description: null,
      model: null,
      location: null,
      operationalStatus: 'active',
      registers: [
        {
          name: 'Velocity',
          address: 33,
          unit: 'mm/s',
        },
      ],
      deletedAt: null,
    };

    await expect(service.postSensor(sensor)).rejects.toThrow('Falha no envio');
    expect(sensorsRepository.insertSensor).not.toHaveBeenCalled();
  });
});
