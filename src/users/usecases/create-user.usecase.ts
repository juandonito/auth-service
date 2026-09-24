import { Injectable } from '@nestjs/common';
import type { PublicUser } from '../dto/public-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordHasher } from '../services/password-hasher.service';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<PublicUser> {
    const passwordHash = await this.passwordHasher.hash(password);
    return this.userRepository.create({ email, passwordHash });
  }
}
