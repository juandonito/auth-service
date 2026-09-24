import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  generateMockPassword,
  generateMockRegisterDto,
} from '@test/mock/auth.mock';
import {
  generateRandomInt,
  generateRandomString,
} from '@test/mock/common.mock';
import { RegisterDto } from './register.dto';

/** Mirrors what the global ValidationPipe does: transform, then validate. */
async function toValidatedDto(body: object) {
  const dto = plainToInstance(RegisterDto, body);
  const errors = await validate(dto);
  return { dto, failedProperties: errors.map(({ property }) => property) };
}

describe('RegisterDto', () => {
  it('should accept a valid email and password', async () => {
    const { failedProperties } = await toValidatedDto(
      generateMockRegisterDto(),
    );

    expect(failedProperties).toEqual([]);
  });

  it('should trim and lowercase the email', async () => {
    const { email } = generateMockRegisterDto();

    const { dto } = await toValidatedDto(
      generateMockRegisterDto({ email: `  ${email.toUpperCase()} ` }),
    );

    expect(dto.email).toBe(email);
  });

  it.each([
    ['an invalid email', { email: generateRandomString() }],
    ['a non-string email', { email: generateRandomInt() }],
  ])('should reject %s', async (_, override) => {
    const { failedProperties } = await toValidatedDto(
      Object.assign(generateMockRegisterDto(), override),
    );

    expect(failedProperties).toEqual(['email']);
  });

  it('should accept a password of exactly 9 characters', async () => {
    const { failedProperties } = await toValidatedDto(
      generateMockRegisterDto({ password: generateMockPassword(9) }),
    );

    expect(failedProperties).toEqual([]);
  });

  it.each([
    ['without an uppercase letter', generateMockPassword().toLowerCase()],
    ['without a lowercase letter', generateMockPassword().toUpperCase()],
    ['without a digit', generateMockPassword().replace(/\d/g, 'x')],
    ['shorter than 9 characters', generateMockPassword(8)],
    ['longer than 128 characters', generateMockPassword(129)],
  ])('should reject a password %s', async (_, password) => {
    const { failedProperties } = await toValidatedDto(
      generateMockRegisterDto({ password }),
    );

    expect(failedProperties).toEqual(['password']);
  });
});
