import { NormalizeEmail } from '@common/decorators/normalize-email.decorator';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Deliberately has no password strength rules: those apply at registration only. */
export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
