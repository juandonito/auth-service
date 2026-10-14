import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

@Injectable()
export class PasswordHasherService implements OnModuleInit {
  /**
   * Hash of a throwaway password, started at construction so no request pays
   * for it. Built by `hash`, so it always has the same argon2 parameters as
   * real hashes.
   */
  private readonly dummyHash = this.hash(randomBytes(16).toString('hex'));

  constructor() {
    // Marks a failure as handled so it can't crash the process as an
    // unhandled rejection; `onModuleInit` and `verifyDummy` still see it.
    this.dummyHash.catch(() => undefined);
  }

  /** Fails fast: if the dummy hash can't be built, the application must not start. */
  async onModuleInit(): Promise<void> {
    await this.dummyHash;
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Burns the same time as a real `verify` and returns nothing, for when there
   * is no stored hash to check (unknown email), so the caller can't be timed.
   */
  async verifyDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password);
  }
}
