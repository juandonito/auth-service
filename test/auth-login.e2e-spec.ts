import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@common/database/prisma.service';
import { Role } from '@generated/prisma/client';
import { PasswordHasher } from '@users/services/password-hasher.service';
import { generateMockLoginDto, generateMockPassword } from './mock/auth.mock';
import { generateRandomEmail, generateRandomString } from './mock/common.mock';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenVerifier: JwtService;
  let referenceSigner: JwtService;
  let secret: string;
  const seededEmails: string[] = [];

  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  const seedUser = async (role: Role = Role.USER) => {
    const { email, password } = generateMockLoginDto();
    const passwordHash = await app
      .get(PasswordHasher, { strict: false })
      .hash(password);
    seededEmails.push(email);
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
    });
    return { user, email, password };
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
    secret = config.getOrThrow<string>('JWT_SECRET');
    tokenVerifier = new JwtService({ secret });
    referenceSigner = new JwtService({
      secret,
      signOptions: { expiresIn: config.getOrThrow('JWT_EXPIRES_IN') },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: seededEmails } } });
    await app.close();
  });

  it('should respond 200 with an access token and nothing else for valid credentials', async () => {
    const { email, password } = await seedUser();

    const { body } = await login({ email, password }).expect(200);

    expect(Object.keys(body)).toEqual(['accessToken']);
  });

  it.each([Role.USER, Role.ADMIN])(
    'should issue a token carrying the id and the %s role of the user',
    async (role) => {
      const { user, email, password } = await seedUser(role);

      const { body } = await login({ email, password }).expect(200);

      await expect(
        tokenVerifier.verifyAsync(body.accessToken),
      ).resolves.toMatchObject({ sub: user.id, role });
    },
  );

  it('should issue a token that only verifies with the configured secret', async () => {
    const { email, password } = await seedUser();

    const { body } = await login({ email, password }).expect(200);

    await expect(
      new JwtService({ secret: generateRandomString(32) }).verifyAsync(
        body.accessToken,
      ),
    ).rejects.toThrow();
  });

  it('should issue a token that expires after the configured lifetime', async () => {
    const { email, password } = await seedUser();

    const { body } = await login({ email, password }).expect(200);

    const lifetime = ({ exp, iat }: { exp: number; iat: number }) => exp - iat;
    const reference = referenceSigner.decode(
      await referenceSigner.signAsync({}),
    );
    expect(lifetime(tokenVerifier.decode(body.accessToken))).toBe(
      lifetime(reference),
    );
  });

  it('should respond 401 "invalid credentials" for an unknown email', async () => {
    const { body } = await login(generateMockLoginDto()).expect(401);

    expect(body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'invalid credentials',
    });
  });

  it('should respond 401 "invalid credentials" for a wrong password', async () => {
    const { email } = await seedUser();

    const { body } = await login({
      email,
      password: generateMockPassword(),
    }).expect(401);

    expect(body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'invalid credentials',
    });
  });

  it('should not reveal through the response whether the email exists', async () => {
    const { email } = await seedUser();
    const dto = generateMockLoginDto();

    const [wrongPassword, unknownEmail] = await Promise.all([
      login({ email, password: dto.password }),
      login(dto),
    ]);

    expect(wrongPassword.status).toBe(unknownEmail.status);
    expect(wrongPassword.text).toBe(unknownEmail.text);
  });

  it('should match the email case-insensitively and ignore surrounding whitespace', async () => {
    const { email, password } = await seedUser();

    await login({ email: `  ${email.toUpperCase()} `, password }).expect(200);
  });

  it('should not trim the password', async () => {
    const { email, password } = await seedUser();

    await login({ email, password: ` ${password} ` }).expect(401);
  });

  it('should never include the password hash in a response body', async () => {
    const { email, password } = await seedUser();

    const responses = [
      await login({ email, password }),
      await login({ email, password: generateMockPassword() }),
      await login(generateMockLoginDto({ email: generateRandomEmail() })),
    ];

    for (const { text } of responses) {
      expect(text).not.toMatch(/passwordHash/i);
      expect(text).not.toContain('$argon2');
    }
  });

  it.each([
    ['an invalid email', { email: generateRandomString() }],
    ['a missing email', { email: undefined }],
    ['a missing password', { password: undefined }],
    ['a non-string password', { password: 12345 }],
    ['an empty password', { password: '' }],
    ['a password longer than 128 characters', { password: 'a'.repeat(129) }],
    ['a client-chosen role', { role: Role.ADMIN }],
  ])('should respond 400 for %s', async (_, override) => {
    const dto = Object.assign(generateMockLoginDto(), override);

    await login(dto).expect(400);
  });
});
