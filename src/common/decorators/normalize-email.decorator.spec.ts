import { plainToInstance } from 'class-transformer';
import { generateRandomEmail, generateRandomInt } from '@test/mock/common.mock';
import { NormalizeEmail } from './normalize-email.decorator';

class TestDto {
  @NormalizeEmail()
  email: unknown;
}

describe('NormalizeEmail', () => {
  it('should trim surrounding whitespace from a string email', () => {
    const email = generateRandomEmail();

    const dto = plainToInstance(TestDto, { email: `  ${email} ` });

    expect(dto.email).toBe(email);
  });

  it('should lowercase a string email', () => {
    const email = generateRandomEmail();

    const dto = plainToInstance(TestDto, { email: email.toUpperCase() });

    expect(dto.email).toBe(email);
  });

  it('should leave a non-string value untouched so validation can reject it', () => {
    const value = generateRandomInt();

    const dto = plainToInstance(TestDto, { email: value });

    expect(dto.email).toBe(value);
  });
});
