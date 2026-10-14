import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  generateMockLoginDto,
  generateMockPassword,
} from '@test/mock/auth.mock';
import {
  generateRandomInt,
  generateRandomString,
} from '@test/mock/common.mock';
import { LoginDto } from './login.dto';

/** Mirrors what the global ValidationPipe does: transform, then validate. */
async function toValidatedDto(body: object) {
  const dto = plainToInstance(LoginDto, body);
  const errors = await validate(dto);
  return { dto, failedProperties: errors.map(({ property }) => property) };
}

describe('LoginDto', () => {
  it('should accept a valid email and password', async () => {
    const { failedProperties } = await toValidatedDto(generateMockLoginDto());

    expect(failedProperties).toEqual([]);
  });

  it('should trim the email', async () => {
    const { email } = generateMockLoginDto();

    const { dto } = await toValidatedDto(
      generateMockLoginDto({ email: `  ${email} ` }),
    );

    expect(dto.email).toBe(email);
  });

  it('should lowercase the email', async () => {
    const { email } = generateMockLoginDto();

    const { dto } = await toValidatedDto(
      generateMockLoginDto({ email: email.toUpperCase() }),
    );

    expect(dto.email).toBe(email);
  });

  it.each([
    ['an invalid email', { email: generateRandomString() }],
    ['a non-string email', { email: generateRandomInt() }],
  ])('should reject %s', async (_, override) => {
    const { failedProperties } = await toValidatedDto(
      Object.assign(generateMockLoginDto(), override),
    );

    expect(failedProperties).toEqual(['email']);
  });

  it('should reject a missing email', async () => {
    const { failedProperties } = await toValidatedDto({
      password: generateMockPassword(),
    });

    expect(failedProperties).toEqual(['email']);
  });

  it('should reject a missing password', async () => {
    const { failedProperties } = await toValidatedDto({
      email: generateMockLoginDto().email,
    });

    expect(failedProperties).toEqual(['password']);
  });

  it.each([
    ['a non-string password', generateRandomInt()],
    ['an empty password', ''],
    ['a password longer than 128 characters', generateMockPassword(129)],
  ])('should reject %s', async (_, password) => {
    const { failedProperties } = await toValidatedDto(
      Object.assign(generateMockLoginDto(), { password }),
    );

    expect(failedProperties).toEqual(['password']);
  });

  it('should accept a password of exactly 128 characters', async () => {
    const { failedProperties } = await toValidatedDto(
      generateMockLoginDto({ password: generateMockPassword(128) }),
    );

    expect(failedProperties).toEqual([]);
  });

  it('should not apply the register strength rules to the password', async () => {
    const { failedProperties } = await toValidatedDto(
      generateMockLoginDto({
        password: generateRandomString(3, 'abcdefghijklmnopqrstuvwxyz'),
      }),
    );

    expect(failedProperties).toEqual([]);
  });

  it('should not trim the password', async () => {
    const password = ` ${generateMockPassword()} `;

    const { dto } = await toValidatedDto(generateMockLoginDto({ password }));

    expect(dto.password).toBe(password);
  });
});
