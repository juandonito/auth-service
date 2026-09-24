import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(9, { message: 'password must be at least 9 characters' })
  @MaxLength(128, { message: 'password must be at most 128 characters' })
  @Matches(/[a-z]/, {
    message: 'password must contain a lowercase letter',
  })
  @Matches(/[A-Z]/, {
    message: 'password must contain an uppercase letter',
  })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password: string;
}
