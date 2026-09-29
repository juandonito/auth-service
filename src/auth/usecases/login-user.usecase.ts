import { Injectable } from '@nestjs/common';
import { UserRepository } from '@users/repositories/user.repository';
import { PasswordHasher } from '@users/services/password-hasher.service';
import type { AccessTokenDto } from '../dto/access-token.dto';
import type { LoginDto } from '../dto/login.dto';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { TokenIssuer } from '../services/token-issuer.service';

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute({ email, password }: LoginDto): Promise<AccessTokenDto> {
    const user = await this.userRepository.findByEmailWithPasswordHash(email);
    if (!user) {
      // Same cost as a real verification, so an unknown email can't be timed.
      await this.passwordHasher.verifyDummy(password);
      throw new InvalidCredentialsError();
    }
    if (!(await this.passwordHasher.verify(user.passwordHash, password))) {
      throw new InvalidCredentialsError();
    }
    return this.tokenIssuer.issue(user);
  }
}
