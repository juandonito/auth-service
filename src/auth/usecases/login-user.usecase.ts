import { Injectable, Logger } from '@nestjs/common';
import type { UserWithPasswordHash } from '@users/dto/user-with-password-hash.dto';
import { UserRepository } from '@users/repositories/user.repository';
import { PasswordHasherService } from '@users/services/password-hasher.service';
import type { AccessTokenDto } from '../dto/access-token.dto';
import type { LoginDto } from '../dto/login.dto';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { TokenIssuerService } from '../services/token-issuer.service';

@Injectable()
export class LoginUserUseCase {
  private readonly logger = new Logger(LoginUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  async execute({ email, password }: LoginDto): Promise<AccessTokenDto> {
    const user = await this.userRepository.findByEmailWithPasswordHash(email);
    if (!user) {
      // Same cost as a real verification, so an unknown email can't be timed.
      await this.passwordHasher.verifyDummy(password);
      throw new InvalidCredentialsError();
    }
    if (!(await this.isPasswordValid(user, password))) {
      throw new InvalidCredentialsError();
    }
    return this.tokenIssuer.issue(user);
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
