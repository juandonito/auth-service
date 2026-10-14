import {
  generateMockArgumentsHost,
  generateMockHttpResponse,
} from '@test/mock/arguments-host.mock';
import { generateRandomString } from '@test/mock/common.mock';
import { InvalidCredentialsError } from '@auth/errors/invalid-credentials.error';
import { EmailAlreadyExistsError } from '@users/errors/email-already-exists.error';
import { DomainError } from '../errors/domain.error';
import { DomainExceptionFilter } from './domain-exception.filter';

class UnmappedError extends DomainError {}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('should respond 409 Conflict for EmailAlreadyExistsError', () => {
    const response = generateMockHttpResponse();
    const error = new EmailAlreadyExistsError();

    filter.catch(error, generateMockArgumentsHost(response));

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: error.message,
    });
  });

  it('should respond 401 Unauthorized with "invalid credentials" for InvalidCredentialsError', () => {
    const response = generateMockHttpResponse();

    filter.catch(
      new InvalidCredentialsError(),
      generateMockArgumentsHost(response),
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'invalid credentials',
    });
  });

  it('should respond 500 without leaking the message for an unmapped domain error', () => {
    const response = generateMockHttpResponse();
    const secret = generateRandomString();

    filter.catch(
      new UnmappedError(secret),
      generateMockArgumentsHost(response),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(secret);
  });
});
