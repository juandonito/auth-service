import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '@users/users.module';
import { AuthController } from './auth.controller';
import { TokenIssuer } from './services/token-issuer.service';
import { RegisterUserUseCase } from './usecases/register-user.usecase';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.getOrThrow('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [RegisterUserUseCase, TokenIssuer],
})
export class AuthModule {}
