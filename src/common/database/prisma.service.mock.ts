import { generateMockRefreshToken } from '@test/mock/refresh-token.mock';
import { generateMockPublicUser, generateMockUser } from '@test/mock/user.mock';

export type MockPrismaService = ReturnType<typeof generateMockPrismaService>;

/**
 * PrismaService double whose methods resolve to random data by default.
 * Override per test with `mockResolvedValue` / `mockRejectedValue`.
 *
 * `$transaction` runs its callback against `tx`, a client separate from the
 * top-level one, so a test can tell a write made inside the transaction from
 * one made outside it.
 */
export function generateMockPrismaService() {
  const tx = {
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue(generateMockRefreshToken()),
    },
  };
  return {
    user: {
      create: jest.fn().mockResolvedValue(generateMockPublicUser()),
      findUnique: jest.fn().mockResolvedValue(generateMockUser()),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue(generateMockRefreshToken()),
      findUnique: jest.fn().mockResolvedValue(generateMockRefreshToken()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tx,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
}
