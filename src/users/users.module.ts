import { Module } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { PasswordHasher } from './services/password-hasher.service';
import { CreateUserUseCase } from './usecases/create-user.usecase';

@Module({
  providers: [UserRepository, PasswordHasher, CreateUserUseCase],
  exports: [UserRepository, PasswordHasher, CreateUserUseCase],
})
export class UsersModule {}
