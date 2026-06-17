jest.mock('@weber-nexus/repository', () => ({
  ControllersRepository: class {},
  SensorsRepository: class {},
}));
const mockLoggerError = jest.fn();
jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    error = mockLoggerError;
    info = jest.fn();
    warn = jest.fn();
  },
}));
jest.mock('../../polling/polling-runtime.service', () => ({
  PollingRuntimeService: class {},
}));

import type {
  Controller,
  NewSensor,
  Sensor,
  SensorWrite,
} from '@weber-nexus/repository';
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
    insertSensor: jest.Mock;
    updateSensor: jest.Mock;
    deleteSensor: jest.Mock;
  };
  let pollingRuntimeService: { refreshController: jest.Mock };
  let controllerXmlConfigService: { uploadControllerConfig: jest.Mock };
  let service: SensorsService;

  beforeEach(() => {
    mockLoggerError.mockClear();
    controllersRepository = {
      findById: jest.fn().mockResolvedValue(controller),
      updateXmlSyncMetadata: jest.fn(),
    };
    sensorsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByControllerId: jest.fn().mockResolvedValue([]),
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
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao enviar XML ao criar sensor Pump'),
      expect.any(Error),
    );
  });

  it('allows sensors with the same node id when register addresses are different', async () => {
    const existingSensor = sensorRecord({
      id: 10,
      nodeId: 2,
      name: 'Pump A',
      registers: [{ name: 'Velocity', address: 33, unit: 'mm/s' }],
    });
    const newSensor: NewSensor = {
      controllerId: 1,
      nodeId: 2,
      name: 'Pump B',
      description: null,
      model: null,
      location: null,
      operationalStatus: 'active',
      registers: [{ name: 'Temperature', address: 34, unit: 'C' }],
      deletedAt: null,
    };
    const insertedSensor = sensorRecord({
      id: 11,
      nodeId: 2,
      name: 'Pump B',
      registers: newSensor.registers,
    });
    sensorsRepository.findByControllerId.mockResolvedValue([existingSensor]);
    sensorsRepository.insertSensor.mockResolvedValue(insertedSensor);
    controllerXmlConfigService.uploadControllerConfig.mockResolvedValue({
      xmlConfig: '<configuration />',
      xmlConfigChecksum: 'checksum',
      xmlLastSyncedAt: new Date('2026-06-10T00:00:00.000Z'),
    });

    await expect(service.postSensor(newSensor)).resolves.toEqual(
      insertedSensor,
    );
    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).toHaveBeenCalledWith(controller, [existingSensor, newSensor]);
    expect(sensorsRepository.insertSensor).toHaveBeenCalledWith(newSensor);
  });

  it('rejects duplicate register addresses on the same controller', async () => {
    const existingSensor = sensorRecord({
      id: 10,
      nodeId: 2,
      name: 'Pump A',
      registers: [{ name: 'Velocity', address: 33, unit: 'mm/s' }],
    });
    const newSensor: NewSensor = {
      controllerId: 1,
      nodeId: 2,
      name: 'Pump B',
      description: null,
      model: null,
      location: null,
      operationalStatus: 'active',
      registers: [{ name: 'Temperature', address: 33, unit: 'C' }],
      deletedAt: null,
    };
    sensorsRepository.findByControllerId.mockResolvedValue([existingSensor]);

    await expect(service.postSensor(newSensor)).rejects.toThrow(
      'Endereço de registrador 33 já está cadastrado',
    );
    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).not.toHaveBeenCalled();
    expect(sensorsRepository.insertSensor).not.toHaveBeenCalled();
  });

  it('rejects more than one status register for the same node', async () => {
    const existingSensor = sensorRecord({
      id: 10,
      nodeId: 2,
      name: 'N2-Link',
      registers: [
        {
          name: 'Link',
          address: 40,
          unit: '',
          isHealthCheck: true,
        },
      ],
    });
    const newSensor: NewSensor = {
      controllerId: 1,
      nodeId: 2,
      name: 'N2-Extra-Link',
      description: null,
      model: null,
      location: null,
      operationalStatus: 'active',
      registers: [
        {
          name: 'Status',
          address: 39,
          unit: '',
          isHealthCheck: true,
        },
      ],
      deletedAt: null,
    };
    sensorsRepository.findByControllerId.mockResolvedValue([existingSensor]);

    await expect(service.postSensor(newSensor)).rejects.toThrow(
      'Nó 2 deve ter apenas um registrador de status',
    );
    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).not.toHaveBeenCalled();
    expect(sensorsRepository.insertSensor).not.toHaveBeenCalled();
  });

  it('updates internal-only sensor fields without uploading XML', async () => {
    const currentSensor = sensorRecord({
      id: 12,
      nodeId: 2,
      name: 'Pump B',
      registers: rangeRegisters(33, 38),
    });
    const update = sensorWrite({
      ...currentSensor,
      description: 'Mancal principal',
      model: 'QM30VT2',
      location: 'Linha 2',
    });
    const updatedSensor = {
      ...currentSensor,
      ...update,
      updatedAt: new Date('2026-06-11T00:00:00.000Z'),
    };
    sensorsRepository.findById.mockResolvedValue(currentSensor);
    sensorsRepository.updateSensor.mockResolvedValue(updatedSensor);

    await expect(service.updateSensor(update)).resolves.toEqual(updatedSensor);
    expect(sensorsRepository.findByControllerId).not.toHaveBeenCalled();
    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).not.toHaveBeenCalled();
    expect(controllersRepository.updateXmlSyncMetadata).not.toHaveBeenCalled();
    expect(pollingRuntimeService.refreshController).not.toHaveBeenCalled();
  });

  it('uploads XML when a sensor name changes with valid node 2 registers', async () => {
    const currentSensor = sensorRecord({
      id: 12,
      nodeId: 2,
      name: 'Pump B',
      registers: rangeRegisters(33, 38),
    });
    const update = sensorWrite({
      ...currentSensor,
      name: 'Pump B Renamed',
      description: 'Mancal principal',
      location: 'Linha 2',
    });
    const nextSensor = { ...currentSensor, ...update };
    const xmlMetadata = {
      xmlConfig: '<configuration />',
      xmlConfigChecksum: 'checksum-2',
      xmlLastSyncedAt: new Date('2026-06-11T00:00:00.000Z'),
    };
    sensorsRepository.findById.mockResolvedValue(currentSensor);
    sensorsRepository.findByControllerId.mockResolvedValue([currentSensor]);
    sensorsRepository.updateSensor.mockResolvedValue(nextSensor);
    controllerXmlConfigService.uploadControllerConfig.mockResolvedValue(
      xmlMetadata,
    );

    await expect(service.updateSensor(update)).resolves.toEqual(nextSensor);
    expect(
      controllerXmlConfigService.uploadControllerConfig,
    ).toHaveBeenCalledWith(controller, [nextSensor]);
    expect(controllersRepository.updateXmlSyncMetadata).toHaveBeenCalledWith(
      1,
      xmlMetadata,
    );
    expect(pollingRuntimeService.refreshController).toHaveBeenCalledWith(1);
  });

  it('logs XML upload failure and does not delete a sensor locally', async () => {
    const sensor = {
      id: 10,
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
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    };
    sensorsRepository.findById.mockResolvedValue(sensor);
    sensorsRepository.findByControllerId.mockResolvedValue([sensor]);

    await expect(service.deleteSensor(sensor.id)).rejects.toThrow(
      'Falha no envio',
    );
    expect(sensorsRepository.deleteSensor).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao enviar XML ao remover sensor 10'),
      expect.any(Error),
    );
  });
});

function sensorRecord({
  id,
  nodeId,
  name,
  registers,
}: {
  id: number;
  nodeId: number;
  name: string;
  registers: NewSensor['registers'];
}): Sensor {
  return {
    id,
    controllerId: 1,
    nodeId,
    name,
    description: null,
    model: null,
    location: null,
    operationalStatus: 'active',
    registers,
    deletedAt: null,
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
}

function sensorWrite(sensor: Sensor): SensorWrite {
  return {
    id: sensor.id,
    controllerId: sensor.controllerId,
    nodeId: sensor.nodeId,
    name: sensor.name,
    description: sensor.description,
    model: sensor.model,
    location: sensor.location,
    operationalStatus: sensor.operationalStatus,
    registers: sensor.registers,
    deletedAt: sensor.deletedAt,
  };
}

function rangeRegisters(
  firstAddress: number,
  lastAddress: number,
): NewSensor['registers'] {
  return Array.from({ length: lastAddress - firstAddress + 1 }, (_, index) => ({
    name: `Registro ${firstAddress + index}`,
    address: firstAddress + index,
    unit: '',
  }));
}
