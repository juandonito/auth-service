import { DomainError } from '@common/errors/domain.error';

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('invalid refresh token');
  }
}
