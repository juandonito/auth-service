import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JsonWebTokenError,
  JwtService,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { IssuedRefreshToken } from '../dto/issued-refresh-token.dto';
import type { RefreshTokenPayload } from '../dto/refresh-token-payload.dto';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { TokenHasherService } from './token-hasher.service';

const ALGORITHM = 'HS256';

/** The only place that knows the refresh token payload shape and its secret. */
@Injectable()
export class RefreshTokenIssuerService {
  private readonly logger = new Logger(RefreshTokenIssuerService.name);
  private readonly secret: string;
  private readonly expiresIn: JwtSignOptions['expiresIn'];

  constructor(
    private readonly jwtService: JwtService,
    config: ConfigService,
    private readonly tokenHasher: TokenHasherService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.expiresIn = config.getOrThrow<JwtSignOptions['expiresIn']>(
      'JWT_REFRESH_EXPIRES_IN',
    );
  }

  /**
   * Signs a token without touching the database: the row id has to exist
   * before signing (it is the `jti`) and the hash after, so callers persist
   * the returned values afterwards.
   */
  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const id = randomUUID();
    const token = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.secret,
        algorithm: ALGORITHM,
        expiresIn: this.expiresIn,
        jwtid: id,
      },
    );
    return {
      id,
      familyId,
      token,
      tokenHash: this.tokenHasher.hash(token),
      expiresAt: this.expiresAtOf(token),
    };
  }

  /**
   * Every way a token can fail verification ends in the same error. A bad
   * token (`JsonWebTokenError` and its subclasses: bad signature, expired,
   * malformed) is routine and not logged. Any other failure (e.g. a broken
   * secret) is a server fault the operator must see, so its stack is logged
   * while the caller still gets the same answer. The token itself is never
   * logged.
   */
  async verify(token: string): Promise<RefreshTokenPayload> {
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
        algorithms: [ALGORITHM],
      });
    } catch (error) {
      if (!(error instanceof JsonWebTokenError)) {
        this.logger.error(
          'Unexpected error while verifying a refresh token',
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw new InvalidRefreshTokenError();
    }
    if (!this.hasSubAndJti(payload)) {
      throw new InvalidRefreshTokenError();
    }
    return { sub: payload.sub, jti: payload.jti };
  }

  /** Reads `exp` back from the signed token so the row and the JWT can't drift apart. */
  private expiresAtOf(token: string): Date {
    const decoded: unknown = this.jwtService.decode(token);
    const exp =
      typeof decoded === 'object' && decoded !== null && 'exp' in decoded
        ? decoded.exp
        : undefined;
    if (typeof exp !== 'number') {
      throw new Error('refresh token has no exp claim');
    }
    return new Date(exp * 1000);
  }

  private hasSubAndJti(payload: unknown): payload is RefreshTokenPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }
    const { sub, jti } = payload as Record<string, unknown>;
    return (
      typeof sub === 'string' &&
      sub !== '' &&
      typeof jti === 'string' &&
      jti !== ''
    );
  }
}
