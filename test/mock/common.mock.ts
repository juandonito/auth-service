import { randomInt, randomUUID } from 'node:crypto';

const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random integer in [min, max] (both inclusive). */
export function generateRandomInt(min = 0, max = 1_000_000): number {
  return randomInt(min, max + 1);
}

export function generateRandomString(
  length = 12,
  alphabet = ALPHANUMERIC,
): string {
  return Array.from(
    { length },
    () => alphabet[randomInt(alphabet.length)],
  ).join('');
}

export function generateRandomId(): string {
  return randomUUID();
}

export function generateRandomEmail(): string {
  return `${generateRandomString(10).toLowerCase()}@${generateRandomString(8).toLowerCase()}.com`;
}

/** Random date between `from` and `to` (defaults: the last year). */
export function generateRandomDate(
  from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  to = new Date(),
): Date {
  return new Date(generateRandomInt(from.getTime(), to.getTime()));
}

export function pickRandom<T>(values: readonly T[]): T {
  return values[randomInt(values.length)];
}
