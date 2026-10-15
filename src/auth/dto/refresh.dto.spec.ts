import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { generateMockRefreshDto } from '@test/mock/auth.mock';
import { generateRandomInt } from '@test/mock/common.mock';
import { RefreshDto } from './refresh.dto';

/** Mirrors what the global ValidationPipe does: transform, then validate. */
async function toFailedProperties(body: object) {
  const errors = await validate(plainToInstance(RefreshDto, body));
  return errors.map(({ property }) => property);
}

describe('RefreshDto', () => {
  it('should accept a refresh token', async () => {
    await expect(toFailedProperties(generateMockRefreshDto())).resolves.toEqual(
      [],
    );
  });

  it('should reject a missing refresh token', async () => {
    await expect(toFailedProperties({})).resolves.toEqual(['refreshToken']);
  });

  it.each([
    ['a non-string refresh token', generateRandomInt()],
    ['an empty refresh token', ''],
  ])('should reject %s', async (_, refreshToken) => {
    await expect(
      toFailedProperties(generateMockRefreshDto({ refreshToken } as never)),
    ).resolves.toEqual(['refreshToken']);
  });
});
