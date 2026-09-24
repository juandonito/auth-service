import { DomainError } from '@common/errors/domain.error';

export class EmailAlreadyExistsError extends DomainError {
  constructor() {
    super('Email already registered');
  }
}
