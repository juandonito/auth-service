import { generateRandomInt, generateRandomString } from './common.mock';

/** Random password that satisfies the register rules (9+ chars, upper, lower, digit). */
export function generateMockPassword(
  length = generateRandomInt(9, 32),
): string {
  const required =
    generateRandomString(1, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') +
    generateRandomString(1, 'abcdefghijklmnopqrstuvwxyz') +
    generateRandomString(1, '0123456789');
  return required + generateRandomString(length - required.length);
}
