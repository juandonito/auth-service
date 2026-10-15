import { Injectable, Logger } from '@nestjs/common';
import type { UserWithPasswordHash } from '@users/dto/user-with-password-hash.dto';
import { UserRepository } from '@users/repositories/user.repository';
import { PasswordHasherService } from '@users/services/password-hasher.service';
import type { AuthTokensDto } from '../dto/auth-tokens.dto';
import type { LoginDto } from '../dto/login.dto';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RefreshTokenIssuerService } from '../services/refresh-token-issuer.service';
import { TokenIssuerService } from '../services/token-issuer.service';

@Injectable()
export class LoginUserUseCase {
  private readonly logger = new Logger(LoginUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenIssuer: TokenIssuerService,
    private readonly refreshTokenIssuer: RefreshTokenIssuerService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute({ email, password }: LoginDto): Promise<AuthTokensDto> {
    const user = await this.userRepository.findByEmailWithPasswordHash(email);
    if (!user) {
      // Same cost as a real verification, so an unknown email can't be timed.
      await this.passwordHasher.verifyDummy(password);
      throw new InvalidCredentialsError();
    }
    if (!(await this.isPasswordValid(user, password))) {
      throw new InvalidCredentialsError();
    }
    const { accessToken } = await this.tokenIssuer.issue(user);
    const refreshToken = await this.startSession(user.id);
    return { accessToken, refreshToken };
  }

  /**
   * Issues the refresh token of a new family and persists its row (hash only).
   * Returns the raw token, the only copy that will ever exist.
   */
  private async startSession(userId: string): Promise<string> {
    const { token, id, familyId, tokenHash, expiresAt } =
      await this.refreshTokenIssuer.issue(userId);
    await this.refreshTokenRepository.create({
      id,
      familyId,
      userId,
      tokenHash,
      expiresAt,
    });
    return token;
  }

  /**
   * A corrupt stored hash makes the verification throw. Letting that escape
   * would answer 500 only for emails that exist, so it is treated as a failed
   * login (and logged for the operator) instead.
   */
  private async isPasswordValid(
    { id, passwordHash }: UserWithPasswordHash,
    password: string,
  ): Promise<boolean> {
    try {
      return await this.passwordHasher.verify(passwordHash, password);
    } catch (error) {
      this.logger.error(
        `Could not verify the stored password hash of user ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      // The failure is instant, so pay the cost of a real verification.
      await this.passwordHasher.verifyDummy(password);
      return false;
    }
  }
}
