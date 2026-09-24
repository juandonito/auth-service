import { generateMockUser } from '../../../test/mock/user.mock';

export type MockPasswordHasher = ReturnType<typeof generateMockPasswordHasher>;

/** PasswordHasher double whose methods resolve to random data by default. */
export function generateMockPasswordHasher() {
  return {
    hash: jest.fn().mockResolvedValue(generateMockUser().passwordHash),
    verify: jest.fn().mockResolvedValue(true),
  };
}
