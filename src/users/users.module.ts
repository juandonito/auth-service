import { Module } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { PasswordHasherService } from './services/password-hasher.service';
import { CreateUserUseCase } from './usecases/create-user.usecase';

@Module({
  providers: [UserRepository, PasswordHasherService, CreateUserUseCase],
  exports: [UserRepository, PasswordHasherService, CreateUserUseCase],
})
export class UsersModule {}
