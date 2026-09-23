import { Prisma } from '../../src/generated/prisma/client';
import { generateRandomString, pickRandom } from './common.mock';

export const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

export function generateMockPrismaKnownError(
  code = pickRandom(['P1001', 'P2003', 'P2025']),
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(generateRandomString(), {
    code,
    clientVersion: generateRandomString(5),
  });
}
