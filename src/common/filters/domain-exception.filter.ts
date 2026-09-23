import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { EmailAlreadyExistsError } from '../../users/errors/email-already-exists.error';
import { DomainError } from '../errors/domain.error';

/** The single place where business errors are mapped to HTTP status codes. */
const STATUS_BY_ERROR = new Map<
  abstract new (...args: never[]) => DomainError,
  HttpStatus
>([[EmailAlreadyExistsError, HttpStatus.CONFLICT]]);

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_ERROR.get(
      exception.constructor as abstract new (...args: never[]) => DomainError,
    );

    if (status === undefined) {
      this.logger.error(
        `Unmapped domain error: ${exception.name}`,
        exception.stack,
      );
      const internal = HttpStatus.INTERNAL_SERVER_ERROR;
      response.status(internal).json({
        statusCode: internal,
        message: STATUS_CODES[internal],
      });
      return;
    }

    response.status(status).json({
      statusCode: status,
      error: STATUS_CODES[status],
      message: exception.message,
    });
  }
}
