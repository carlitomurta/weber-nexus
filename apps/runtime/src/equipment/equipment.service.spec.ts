jest.mock('@weber-nexus/repository', () => ({
  EquipmentRepository: class {},
  SensorsRepository: class {},
}));

import type {
  Equipment,
  EquipmentType,
  Sensor,
  SensorInstallation,
} from '@weber-nexus/repository';
import { EquipmentService } from './equipment.service';

describe('EquipmentService', () => {
  const equipmentType: EquipmentType = {
    id: 1,
    code: 'electric_motor',
    name: 'Motor elétrico',
    description: null,
    version: 1,
    fieldDefinitions: [
      {
        key: 'ratedPowerKw',
        label: 'Potência nominal',
        type: 'number',
        unit: 'kW',
        required: true,
      },
      {
        key: 'nominalSpeedRpm',
        label: 'Rotação nominal',
        type: 'number',
        unit: 'rpm',
        required: true,
      },
    ],
    active: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const equipment: Equipment = {
    id: 10,
    equipmentTypeId: 1,
    name: 'Motor principal',
    tag: 'MTR-001',
    manufacturer: null,
    model: null,
    serialNumber: null,
    site: null,
    area: null,
    location: null,
    criticality: 'medium',
    operationalStatus: 'active',
    specificAttributes: {
      ratedPowerKw: 30,
      nominalSpeedRpm: 1800,
    },
    deletedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const sensor: Sensor = {
    id: 20,
    controllerId: 1,
    nodeId: 2,
    name: 'Vibração MTR-001',
    description: null,
    model: null,
    location: null,
    operationalStatus: 'active',
    registers: [],
    deletedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const activeInstallation: SensorInstallation = {
    id: 30,
    equipmentId: 11,
    sensorId: 20,
    installedAt: new Date('2026-08-01T00:00:00.000Z'),
    endedAt: null,
    position: null,
    measurementAxis: null,
    notes: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  let equipmentRepository: {
    findEquipmentTypeById: jest.Mock;
    findEquipmentById: jest.Mock;
    insertEquipment: jest.Mock;
    findActiveInstallationBySensorId: jest.Mock;
    insertSensorInstallation: jest.Mock;
    findActiveClassificationByEquipmentId: jest.Mock;
    findStandardByCode: jest.Mock;
    replaceSuggestedClassification: jest.Mock;
    supersedeSuggestedClassification: jest.Mock;
    findEquipmentTypes: jest.Mock;
    findInstallationsByEquipmentIds: jest.Mock;
    findActiveClassificationsByEquipmentIds: jest.Mock;
    findStandardsByIds: jest.Mock;
  };
  let sensorsRepository: { findById: jest.Mock };
  let service: EquipmentService;

  beforeEach(() => {
    equipmentRepository = {
      findEquipmentTypeById: jest.fn().mockResolvedValue(equipmentType),
      findEquipmentById: jest.fn().mockResolvedValue(equipment),
      insertEquipment: jest.fn().mockResolvedValue(equipment),
      findActiveInstallationBySensorId: jest.fn(),
      insertSensorInstallation: jest.fn(),
      findActiveClassificationByEquipmentId: jest.fn().mockResolvedValue(null),
      findStandardByCode: jest.fn().mockResolvedValue({
        id: 1,
        code: 'ISO-20816-3:2022',
      }),
      replaceSuggestedClassification: jest.fn(),
      supersedeSuggestedClassification: jest.fn(),
      findEquipmentTypes: jest.fn().mockResolvedValue([equipmentType]),
      findInstallationsByEquipmentIds: jest.fn().mockResolvedValue([]),
      findActiveClassificationsByEquipmentIds: jest.fn().mockResolvedValue([]),
      findStandardsByIds: jest.fn().mockResolvedValue([]),
    };
    sensorsRepository = { findById: jest.fn().mockResolvedValue(sensor) };
    service = new EquipmentService(
      equipmentRepository as never,
      sensorsRepository as never,
    );
  });

  it('validates required dynamic fields from the equipment type catalog', async () => {
    await expect(
      service.createEquipment({
        equipmentTypeId: 1,
        name: 'Motor principal',
        tag: 'MTR-001',
        manufacturer: null,
        model: null,
        serialNumber: null,
        site: null,
        area: null,
        location: null,
        criticality: 'medium',
        operationalStatus: 'active',
        specificAttributes: {
          nominalSpeedRpm: 1800,
        },
        deletedAt: null,
      }),
    ).rejects.toThrow('Potência nominal é obrigatório');

    expect(equipmentRepository.insertEquipment).not.toHaveBeenCalled();
  });

  it('blocks a sensor already linked to another active equipment installation', async () => {
    equipmentRepository.findActiveInstallationBySensorId.mockResolvedValue(
      activeInstallation,
    );

    await expect(
      service.createSensorInstallation({
        equipmentId: 10,
        sensorId: 20,
        installedAt: new Date('2026-08-02T00:00:00.000Z'),
        endedAt: null,
        position: null,
        measurementAxis: null,
        notes: null,
      }),
    ).rejects.toThrow('Sensor já possui vínculo ativo');

    expect(equipmentRepository.insertSensorInstallation).not.toHaveBeenCalled();
  });
});
