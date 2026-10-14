import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * SHA-256, not argon2: a refresh token is a high-entropy string, not a human
 * password, so a slow hash adds cost without adding security.
 */
@Injectable()
export class TokenHasherService {
  hash(token: string): string {
    return this.digest(token).toString('hex');
  }

  /**
   * Constant-time. A stored hash that is not a SHA-256 hex digest (corrupt
   * row) is a mismatch rather than an error: `timingSafeEqual` throws on
   * unequal lengths, which would answer 500 instead of the usual 401.
   */
  matches(token: string, storedHash: string): boolean {
    if (!SHA256_HEX.test(storedHash)) {
      return false;
    }
    return timingSafeEqual(this.digest(token), Buffer.from(storedHash, 'hex'));
  }

  private digest(token: string): Buffer {
    return createHash('sha256').update(token).digest();
  }
}
