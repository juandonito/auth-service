import { generateRandomString } from './common.mock';

export type MockConfigService = ReturnType<typeof generateMockConfigService>;

export function generateMockDatabaseUrl(): string {
  return `postgresql://${generateRandomString(8)}:${generateRandomString(16)}@localhost:5432/${generateRandomString(8)}`;
}

/** ConfigService double whose methods return random data by default. */
export function generateMockConfigService() {
  return {
    getOrThrow: jest.fn().mockReturnValue(generateMockDatabaseUrl()),
  };
}
