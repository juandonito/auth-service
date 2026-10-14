import { PrismaService } from '@common/database/prisma.service';
import {
  generateMockPrismaService,
  type MockPrismaService,
} from '@common/database/prisma.service.mock';
import { Test } from '@nestjs/testing';
import { generateRandomId, generateRandomString } from '@test/mock/common.mock';
import {
  generateMockCreateRefreshTokenDto,
  generateMockRefreshToken,
} from '@test/mock/refresh-token.mock';
import { RefreshTokenRepository } from './refresh-token.repository';

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = generateMockPrismaService();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = moduleRef.get(RefreshTokenRepository);
  });

  describe('create', () => {
    it('should persist the id, family, user, hash and expiry', async () => {
      const data = generateMockCreateRefreshTokenDto();

      await repository.create(data);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({ data });
    });

    it('should not return the persisted row', async () => {
      await expect(
        repository.create(generateMockCreateRefreshTokenDto()),
      ).resolves.toBeUndefined();
    });

    it('should rethrow a database error', async () => {
      const error = new Error(generateRandomString());
      prisma.refreshToken.create.mockRejectedValue(error);

      await expect(
        repository.create(generateMockCreateRefreshTokenDto()),
      ).rejects.toBe(error);
    });
  });

  describe('findByIdWithTokenHash', () => {
    it('should look the token up by its id', async () => {
      const { id } = generateMockRefreshToken();

      await repository.findByIdWithTokenHash(id);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
    });

    it('should return the row found', async () => {
      const row = generateMockRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(row);

      await expect(repository.findByIdWithTokenHash(row.id)).resolves.toEqual(
        row,
      );
    });

    it('should return null when no token has that id', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        repository.findByIdWithTokenHash(generateRandomId()),
      ).resolves.toBeNull();
    });
  });

  describe('rotate', () => {
    it('should run both writes in a single transaction, not on the top-level client', async () => {
      await repository.rotate(
        generateRandomId(),
        generateMockCreateRefreshTokenDto(),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.tx.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should mark the old token used only if it is still unused, pointing at its replacement', async () => {
      const oldId = generateRandomId();
      const next = generateMockCreateRefreshTokenDto();

      await repository.rotate(oldId, next);

      expect(prisma.tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: expect.any(Date), replacedBy: next.id },
      });
    });

    it('should insert the new token after marking the old one', async () => {
      const next = generateMockCreateRefreshTokenDto();

      await repository.rotate(generateRandomId(), next);

      expect(prisma.tx.refreshToken.create).toHaveBeenCalledWith({
        data: next,
      });
      expect(
        prisma.tx.refreshToken.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.tx.refreshToken.create.mock.invocationCallOrder[0]);
    });

    it('should return true when the old token was exchanged', async () => {
      await expect(
        repository.rotate(
          generateRandomId(),
          generateMockCreateRefreshTokenDto(),
        ),
      ).resolves.toBe(true);
    });

    describe('when another request already used the old token', () => {
      beforeEach(() => {
        prisma.tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      });

      it('should return false', async () => {
        await expect(
          repository.rotate(
            generateRandomId(),
            generateMockCreateRefreshTokenDto(),
          ),
        ).resolves.toBe(false);
      });

      it('should not insert the new token', async () => {
        await repository.rotate(
          generateRandomId(),
          generateMockCreateRefreshTokenDto(),
        );

        expect(prisma.tx.refreshToken.create).not.toHaveBeenCalled();
      });
    });

    it('should rethrow a failure while marking the old token, so the transaction rolls back', async () => {
      const error = new Error(generateRandomString());
      prisma.tx.refreshToken.updateMany.mockRejectedValue(error);

      await expect(
        repository.rotate(
          generateRandomId(),
          generateMockCreateRefreshTokenDto(),
        ),
      ).rejects.toBe(error);
    });

    it('should rethrow a failure while inserting the new token, so the transaction rolls back', async () => {
      const error = new Error(generateRandomString());
      prisma.tx.refreshToken.create.mockRejectedValue(error);

      await expect(
        repository.rotate(
          generateRandomId(),
          generateMockCreateRefreshTokenDto(),
        ),
      ).rejects.toBe(error);
    });
  });
});
