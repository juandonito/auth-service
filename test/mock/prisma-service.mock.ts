import { generateMockPublicUser } from './user.mock';

export type MockPrismaService = ReturnType<typeof generateMockPrismaService>;

/** PrismaService double whose methods resolve to random data by default. Override per test with `mockResolvedValue` / `mockRejectedValue`. */
export function generateMockPrismaService() {
  return {
    user: {
      create: jest.fn().mockResolvedValue(generateMockPublicUser()),
    },
  };
}
