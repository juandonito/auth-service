import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{9,128}$/, {
    message:
      'password must be 9-128 characters and contain an uppercase letter, a lowercase letter and a digit',
  })
  password: string;
}
