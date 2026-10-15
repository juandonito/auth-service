import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@users/repositories/user.repository';
import type { AuthTokensDto } from '../dto/auth-tokens.dto';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RefreshTokenIssuerService } from '../services/refresh-token-issuer.service';
import { TokenHasherService } from '../services/token-hasher.service';
import { TokenIssuerService } from '../services/token-issuer.service';

/**
 * Every rejection throws the same `InvalidRefreshTokenError`, so the caller
 * can't tell a forged token from a used, expired or orphaned one.
 */
@Injectable()
export class RotateRefreshTokenUseCase {
  private readonly logger = new Logger(RotateRefreshTokenUseCase.name);

  constructor(
    private readonly refreshTokenIssuer: RefreshTokenIssuerService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenHasher: TokenHasherService,
    private readonly tokenIssuer: TokenIssuerService,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokensDto> {
    const { jti } = await this.refreshTokenIssuer.verify(refreshToken);

    const row = await this.refreshTokenRepository.findByIdWithTokenHash(jti);
    if (!row) {
      throw new InvalidRefreshTokenError();
    }
    if (!this.tokenHasher.matches(refreshToken, row.tokenHash)) {
      // The signature was valid, so this is a corrupt row or a leaked signing secret.
      this.logger.error(
        `Refresh token ${jti} is validly signed but does not match its stored hash`,
      );
      throw new InvalidRefreshTokenError();
    }
    if (row.revokedAt !== null || row.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepository.findById(row.userId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    // Sign first: nothing is written to the database before both tokens exist.
    const next = await this.refreshTokenIssuer.issue(user.id, row.familyId);
    const { accessToken } = await this.tokenIssuer.issue(user);

    const rotated = await this.refreshTokenRepository.rotate(row.id, {
      id: next.id,
      familyId: next.familyId,
      userId: user.id,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
    });
    if (!rotated) {
      throw new InvalidRefreshTokenError();
    }
    return { accessToken, refreshToken: next.token };
  }
}
