import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule, AuthModule],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here rather than in main.ts so e2e tests get them too.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
