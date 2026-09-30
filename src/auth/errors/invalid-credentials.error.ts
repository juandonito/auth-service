import { DomainError } from '@common/errors/domain.error';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('invalid credentials');
  }
}
