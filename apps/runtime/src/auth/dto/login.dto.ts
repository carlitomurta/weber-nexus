import {
  parseRequestRecord,
  requiredString,
} from '../../common/request-validation';

export type LoginDto = {
  readonly email: string;
  readonly password: string;
};

export function parseLoginDto(value: unknown): LoginDto {
  const body = parseRequestRecord(value);

  return {
    email: requiredString(body, 'email', 'E-mail').toLowerCase(),
    password: requiredString(body, 'password', 'Senha'),
  };
}
