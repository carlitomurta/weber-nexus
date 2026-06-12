import { BadRequestException } from '@nestjs/common';
import { parseInfluxReadingsQueryDto } from './influx-readings-query.dto';

describe('parseInfluxReadingsQueryDto', () => {
  it('normalizes readings query params', () => {
    expect(
      parseInfluxReadingsQueryDto({
        range: '1w',
        controllerId: '12',
        includeHealth: 'true',
      }),
    ).toEqual({
      range: '1w',
      controllerId: 12,
      includeHealth: true,
    });
  });

  it('uses defaults for omitted query params', () => {
    expect(parseInfluxReadingsQueryDto({})).toEqual({
      range: '6m',
      controllerId: undefined,
      includeHealth: false,
    });
  });

  it('rejects invalid ranges', () => {
    expect(() => parseInfluxReadingsQueryDto({ range: '10y' })).toThrow(
      BadRequestException,
    );
  });
});
