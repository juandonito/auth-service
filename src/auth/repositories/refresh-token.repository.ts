import { PrismaService } from '@common/database/prisma.service';
import type { RefreshToken } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import type { CreateRefreshTokenDto } from '../dto/create-refresh-token.dto';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns nothing: the row holds the token hash, which must not travel back out. */
  async create(data: CreateRefreshTokenDto): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  findByIdWithTokenHash(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  /**
   * Exchanges a token for its replacement in one transaction. The old row is
   * only marked used if it still is unused, so of two concurrent exchanges
   * exactly one wins; the loser inserts nothing and gets `false`.
   */
  rotate(oldId: string, next: CreateRefreshTokenDto): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: next.id },
      });
      if (count === 0) {
        return false;
      }
      await tx.refreshToken.create({ data: next });
      return true;
    });
  }
}
