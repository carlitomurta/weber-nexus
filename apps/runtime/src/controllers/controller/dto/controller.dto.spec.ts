import { BadRequestException } from '@nestjs/common';
import {
  parseCreateControllerDto,
  parseUpdateControllerDto,
} from './controller.dto';

describe('controller DTO parsers', () => {
  it('normalizes controller creation payloads', () => {
    expect(
      parseCreateControllerDto({
        name: ' DXM Norte ',
        model: ' DXM1200 ',
        ipAddress: ' 192.168.1.10 ',
        site: ' Linha 1 ',
        port: null,
        isMultihop: true,
        pollingIntervalMs: '60000',
      }),
    ).toEqual({
      name: 'DXM Norte',
      model: 'DXM1200',
      ipAddress: '192.168.1.10',
      site: 'Linha 1',
      port: 0,
      isMultihop: true,
      pollingIntervalMs: 60000,
    });
  });

  it('requires a positive polling interval', () => {
    expect(() =>
      parseCreateControllerDto({
        name: 'DXM',
        model: 'DXM1200',
        ipAddress: '192.168.1.10',
        pollingIntervalMs: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps Multihop undefined when the field is not submitted', () => {
    expect(
      parseCreateControllerDto({
        name: 'DXM',
        model: 'DXM1200',
        ipAddress: '192.168.1.10',
      }),
    ).not.toHaveProperty('isMultihop');
  });

  it('requires an id for updates', () => {
    expect(() =>
      parseUpdateControllerDto({
        name: 'DXM',
        model: 'DXM1200',
        ipAddress: '192.168.1.10',
      }),
    ).toThrow('ID do controlador deve ser um inteiro');
  });
});
