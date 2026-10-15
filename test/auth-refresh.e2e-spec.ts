import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@common/database/prisma.service';
import { Role } from '@generated/prisma/client';
import { PasswordHasherService } from '@users/services/password-hasher.service';
import { generateMockLoginDto } from './mock/auth.mock';
import { generateRandomString } from './mock/common.mock';

const INVALID_REFRESH_TOKEN_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'invalid refresh token',
};

describe('POST /auth/refresh (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessTokenVerifier: JwtService;
  let refreshSigner: JwtService;
  const seededEmails: string[] = [];

  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  const refresh = (body: object) =>
    request(app.getHttpServer()).post('/auth/refresh').send(body);

  const sha256 = (value: string) =>
    createHash('sha256').update(value).digest('hex');

  const seedUser = async (role: Role = Role.USER) => {
    const { email, password } = generateMockLoginDto();
    const passwordHash = await app
      .get(PasswordHasherService, { strict: false })
      .hash(password);
    seededEmails.push(email);
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
    });
    return { user, email, password };
  };

  /** Seeds a user and logs them in: the raw tokens and the row of the refresh token. */
  const startSession = async (role: Role = Role.USER) => {
    const { user, email, password } = await seedUser(role);
    const { body } = await login({ email, password }).expect(200);
    const { jti } = refreshSigner.decode(body.refreshToken);
    const row = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: jti },
    });
    return {
      user,
      accessToken: body.accessToken as string,
      refreshToken: body.refreshToken as string,
      row,
    };
  };

  /** A token signed with the real secret whose row exists, so only the tampered part can fail it. */
  const seedRowFor = async (userId: string, tokenHash: string) => {
    const id = randomUUID();
    await prisma.refreshToken.create({
      data: {
        id,
        familyId: randomUUID(),
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Built from the config, not taken from the app, so the token checks
    // don't just prove the app agrees with itself.
    const config = app.get(ConfigService);
    accessTokenVerifier = new JwtService({
      secret: config.getOrThrow<string>('JWT_SECRET'),
    });
    refreshSigner = new JwtService({
      secret: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: seededEmails } } });
    await app.close();
  });

  describe('with a valid refresh token', () => {
    it('should respond 200 with a new pair and nothing else', async () => {
      const { refreshToken } = await startSession();

      const { body } = await refresh({ refreshToken }).expect(200);

      expect(Object.keys(body).sort()).toEqual(['accessToken', 'refreshToken']);
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it('should store the hash of the new token, not the token, with an expiry equal to its exp', async () => {
      const { refreshToken } = await startSession();

      const { body } = await refresh({ refreshToken }).expect(200);

      const { jti, exp } = refreshSigner.decode(body.refreshToken);
      const row = await prisma.refreshToken.findUniqueOrThrow({
        where: { id: jti },
      });
      expect(row.tokenHash).toBe(sha256(body.refreshToken));
      expect(row.tokenHash).not.toBe(body.refreshToken);
      expect(row.expiresAt).toEqual(new Date(exp * 1000));
      expect(row).toMatchObject({ revokedAt: null, replacedBy: null });
    });

    it('should mark the used token as used and replaced, in the same family as the new one', async () => {
      const { refreshToken, row } = await startSession();

      const { body } = await refresh({ refreshToken }).expect(200);

      const { jti } = refreshSigner.decode(body.refreshToken);
      const [used, next] = await Promise.all([
        prisma.refreshToken.findUniqueOrThrow({ where: { id: row.id } }),
        prisma.refreshToken.findUniqueOrThrow({ where: { id: jti } }),
      ]);
      expect(used.revokedAt).not.toBeNull();
      expect(used.replacedBy).toBe(jti);
      expect(next.familyId).toBe(row.familyId);
      expect(next.userId).toBe(row.userId);
    });

    it('should accept the token returned by a refresh, keeping the family', async () => {
      const { refreshToken, row } = await startSession();

      const first = await refresh({ refreshToken }).expect(200);
      const second = await refresh({
        refreshToken: first.body.refreshToken,
      }).expect(200);

      const { jti } = refreshSigner.decode(second.body.refreshToken);
      const last = await prisma.refreshToken.findUniqueOrThrow({
        where: { id: jti },
      });
      expect(last.familyId).toBe(row.familyId);
      await expect(
        prisma.refreshToken.count({ where: { familyId: row.familyId } }),
      ).resolves.toBe(3);
    });

    it('should keep the family of each login separate', async () => {
      const { refreshToken, row } = await startSession();
      const other = await startSession();

      await refresh({ refreshToken }).expect(200);

      expect(other.row.familyId).not.toBe(row.familyId);
      await expect(
        prisma.refreshToken.count({ where: { familyId: other.row.familyId } }),
      ).resolves.toBe(1);
    });

    it('should issue a token valid for a fresh full lifetime', async () => {
      const { refreshToken } = await startSession();
      const lifetime = ({ exp, iat }: { exp: number; iat: number }) =>
        exp - iat;

      const { body } = await refresh({ refreshToken }).expect(200);

      expect(lifetime(refreshSigner.decode(body.refreshToken))).toBe(
        lifetime(refreshSigner.decode(refreshToken)),
      );
    });

    it('should issue an access token carrying the id and the role of the user', async () => {
      const { user, refreshToken } = await startSession();

      const { body } = await refresh({ refreshToken }).expect(200);

      await expect(
        accessTokenVerifier.verifyAsync(body.accessToken),
      ).resolves.toMatchObject({ sub: user.id, role: user.role });
    });

    it('should pick up a role changed since the login', async () => {
      const { user, refreshToken } = await startSession(Role.USER);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      });

      const { body } = await refresh({ refreshToken }).expect(200);

      await expect(
        accessTokenVerifier.verifyAsync(body.accessToken),
      ).resolves.toMatchObject({ role: Role.ADMIN });
    });

    it('should never include a hash or a user field in the response', async () => {
      const { refreshToken } = await startSession();

      const { text } = await refresh({ refreshToken }).expect(200);

      expect(text).not.toMatch(/tokenHash|passwordHash|email|role/i);
    });
  });

  describe('with a token that cannot be exchanged', () => {
    it('should respond 401 for a token that was already used', async () => {
      const { refreshToken } = await startSession();
      await refresh({ refreshToken }).expect(200);

      const { body } = await refresh({ refreshToken }).expect(401);

      expect(body).toEqual(INVALID_REFRESH_TOKEN_BODY);
    });

    it('should let exactly one of two concurrent refreshes win and write a single new row', async () => {
      const { refreshToken, row } = await startSession();

      const responses = await Promise.all([
        refresh({ refreshToken }),
        refresh({ refreshToken }),
      ]);

      expect(
        responses.map(({ status }) => status).sort((a, b) => a - b),
      ).toEqual([200, 401]);
      await expect(
        prisma.refreshToken.count({ where: { familyId: row.familyId } }),
      ).resolves.toBe(2);
    });

    it('should respond 401 for an expired token', async () => {
      const { user } = await seedUser();
      const id = await seedRowFor(
        user.id,
        generateRandomString(64, '0123456789abcdef'),
      );
      const exp = Math.floor(Date.now() / 1000) - 10;
      const refreshToken = await refreshSigner.signAsync({
        sub: user.id,
        jti: id,
        exp,
      });

      await refresh({ refreshToken }).expect(401);
    });

    it('should respond 401 for a tampered token', async () => {
      const { refreshToken } = await startSession();
      const [header, payload, signature] = refreshToken.split('.');
      const flipped = signature.startsWith('A') ? 'B' : 'A';

      await refresh({
        refreshToken: [header, payload, flipped + signature.slice(1)].join('.'),
      }).expect(401);
    });

    it('should respond 401 for a token signed with another secret', async () => {
      const { user } = await seedUser();
      const jti = await seedRowFor(
        user.id,
        generateRandomString(64, '0123456789abcdef'),
      );
      const refreshToken = await new JwtService({
        secret: generateRandomString(32),
      }).signAsync({ sub: user.id, jti }, { expiresIn: '1m' });

      await refresh({ refreshToken }).expect(401);
    });

    it('should respond 401 for a token signed with another algorithm', async () => {
      const { user } = await seedUser();
      const jti = await seedRowFor(
        user.id,
        generateRandomString(64, '0123456789abcdef'),
      );
      const refreshToken = await refreshSigner.signAsync(
        { sub: user.id, jti },
        { algorithm: 'HS512', expiresIn: '1m' },
      );

      await refresh({ refreshToken }).expect(401);
    });

    it.each([
      ['a missing sub', () => ({ jti: randomUUID() })],
      ['a missing jti', () => ({ sub: randomUUID() })],
      ['a non-string sub', () => ({ sub: 123, jti: randomUUID() })],
      ['a non-string jti', () => ({ sub: randomUUID(), jti: 123 })],
    ])(
      'should respond 401 for a validly signed token with %s',
      async (_, payload) => {
        const refreshToken = await refreshSigner.signAsync(payload(), {
          expiresIn: '1m',
        });

        await refresh({ refreshToken }).expect(401);
      },
    );

    it('should respond 401 for a validly signed token whose hash does not match its row', async () => {
      const { user } = await seedUser();
      const jti = await seedRowFor(
        user.id,
        generateRandomString(64, '0123456789abcdef'),
      );
      const refreshToken = await refreshSigner.signAsync(
        { sub: user.id, jti },
        { expiresIn: '1m' },
      );

      await refresh({ refreshToken }).expect(401);
      await expect(
        prisma.refreshToken.findUniqueOrThrow({ where: { id: jti } }),
      ).resolves.toMatchObject({ revokedAt: null });
    });

    it('should respond 401, not 500, when the stored hash has the wrong length', async () => {
      const { user } = await seedUser();
      const jti = await seedRowFor(user.id, generateRandomString(20));
      const refreshToken = await refreshSigner.signAsync(
        { sub: user.id, jti },
        { expiresIn: '1m' },
      );

      await refresh({ refreshToken }).expect(401);
    });

    it('should respond 401 for a row that expired although its token is still valid', async () => {
      const { refreshToken, row } = await startSession();
      await prisma.refreshToken.update({
        where: { id: row.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh({ refreshToken }).expect(401);
    });

    it('should respond 401 for an access token', async () => {
      const { accessToken } = await startSession();

      await refresh({ refreshToken: accessToken }).expect(401);
    });

    it('should respond 401 for a deleted user, whose tokens are gone with them', async () => {
      const { user, refreshToken } = await startSession();
      await prisma.user.delete({ where: { id: user.id } });

      await refresh({ refreshToken }).expect(401);
      await expect(
        prisma.refreshToken.count({ where: { userId: user.id } }),
      ).resolves.toBe(0);
    });

    it('should leave no new row behind after a rejection', async () => {
      const { user, refreshToken } = await startSession();
      await refresh({ refreshToken }).expect(200);
      const before = await prisma.refreshToken.count({
        where: { userId: user.id },
      });

      await refresh({ refreshToken }).expect(401);

      await expect(
        prisma.refreshToken.count({ where: { userId: user.id } }),
      ).resolves.toBe(before);
    });

    it('should answer every kind of rejection with the exact same body', async () => {
      const { user } = await seedUser();
      const used = await startSession();
      await refresh({ refreshToken: used.refreshToken }).expect(200);
      const mismatched = await refreshSigner.signAsync(
        {
          sub: user.id,
          jti: await seedRowFor(
            user.id,
            generateRandomString(64, '0123456789abcdef'),
          ),
        },
        { expiresIn: '1m' },
      );
      const unknown = await refreshSigner.signAsync(
        { sub: user.id, jti: randomUUID() },
        { expiresIn: '1m' },
      );

      const responses = await Promise.all(
        [
          used.refreshToken,
          mismatched,
          unknown,
          used.accessToken,
          generateRandomString(40),
        ].map((refreshToken) => refresh({ refreshToken })),
      );

      for (const { status, body } of responses) {
        expect(status).toBe(401);
        expect(body).toEqual(INVALID_REFRESH_TOKEN_BODY);
      }
    });
  });

  describe('with an invalid body', () => {
    it.each([
      ['a missing refresh token', {}],
      ['an empty refresh token', { refreshToken: '' }],
      ['a non-string refresh token', { refreshToken: 12345 }],
      [
        'an extra field',
        { refreshToken: generateRandomString(40), role: Role.ADMIN },
      ],
    ])('should respond 400 for %s', async (_, body) => {
      await refresh(body).expect(400);
    });
  });
});
