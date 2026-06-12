import { BadRequestException } from '@nestjs/common';
import { parseCreateSensorDto, parseUpdateSensorDto } from './sensor.dto';

describe('sensor DTO parsers', () => {
  it('normalizes sensor register payloads with local register mapping', () => {
    expect(
      parseCreateSensorDto({
        controllerId: '1',
        nodeId: '2',
        name: ' Bomba ',
        registers: [
          {
            name: ' Vibração ',
            address: '33',
            localRegisterNumber: '4',
            scaleType: 'divide',
            scaleFactor: '100',
            unit: ' mm/s ',
          },
          {
            name: 'Status',
            address: 34,
            isHealthCheck: true,
            unit: '',
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        controllerId: 1,
        nodeId: 2,
        name: 'Bomba',
        registers: [
          expect.objectContaining({
            address: 33,
            localRegisterNumber: 4,
            scaleFactor: 100,
            unit: 'mm/s',
          }),
          expect.objectContaining({
            address: 34,
            isHealthCheck: true,
            unit: '',
          }),
        ],
      }),
    );
  });

  it('rejects invalid local register numbers', () => {
    expect(() =>
      parseCreateSensorDto({
        controllerId: 1,
        nodeId: 2,
        name: 'Bomba',
        registers: [
          {
            name: 'Vibração',
            address: 33,
            localRegisterNumber: 0,
            unit: 'mm/s',
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('requires an id for updates', () => {
    expect(() =>
      parseUpdateSensorDto({
        controllerId: 1,
        nodeId: 2,
        name: 'Bomba',
        registers: [{ name: 'Vibração', address: 33, unit: 'mm/s' }],
      }),
    ).toThrow('ID do sensor deve ser um inteiro');
  });
});
