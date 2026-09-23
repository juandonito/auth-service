import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../users/repositories/user.repository';
import type { RegisterDto } from '../dto/register.dto';
import { PasswordHasher } from '../services/password-hasher.service';

export interface RegisterResult {
  accessToken: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  async execute({ email, password }: RegisterDto): Promise<RegisterResult> {
    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.userRepository.create({ email, passwordHash });
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });
    return { accessToken };
  }
}
