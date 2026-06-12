import { BadRequestException } from '@nestjs/common';
import { parseLoginDto } from './login.dto';

describe('parseLoginDto', () => {
  it('normalizes valid login payloads', () => {
    expect(
      parseLoginDto({
        email: ' OPERADOR@WEBER.COM.BR ',
        password: 'senha-local',
      }),
    ).toEqual({
      email: 'operador@weber.com.br',
      password: 'senha-local',
    });
  });

  it('rejects missing credentials with a Portuguese validation error', () => {
    expect(() => parseLoginDto({ email: '' })).toThrow(BadRequestException);
    expect(() => parseLoginDto({ email: '' })).toThrow('E-mail é obrigatório');
  });
});
