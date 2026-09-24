import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@common/database/prisma.service';
import { Role } from '@generated/prisma/client';
import {
  generateMockPassword,
  generateMockRegisterDto,
} from './mock/auth.mock';
import { generateRandomString } from './mock/common.mock';

describe('POST /auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const registeredEmails: string[] = [];

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: registeredEmails } },
    });
    await app.close();
  });

  it('should create a user with a hashed password and the USER role', async () => {
    const dto = generateMockRegisterDto();
    registeredEmails.push(dto.email);

    await register(dto).expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
    });
    expect(user.passwordHash).not.toBe(dto.password);
    expect(user.passwordHash).not.toContain(dto.password);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.role).toBe(Role.USER);
  });

  it('should return an access token for the created user and nothing else', async () => {
    const dto = generateMockRegisterDto();
    registeredEmails.push(dto.email);

    const { body } = await register(dto).expect(201);

    expect(Object.keys(body)).toEqual(['accessToken']);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
    });
    await expect(
      jwtService.verifyAsync(body.accessToken),
    ).resolves.toMatchObject({ sub: user.id, role: Role.USER });
  });

  it('should respond 409 when the email is already registered', async () => {
    const dto = generateMockRegisterDto();
    registeredEmails.push(dto.email);
    await register(dto).expect(201);

    const { body } = await register(dto).expect(409);

    expect(body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('should treat emails as case-insensitive when detecting duplicates', async () => {
    const dto = generateMockRegisterDto();
    registeredEmails.push(dto.email);
    await register(dto).expect(201);

    await register(
      generateMockRegisterDto({
        email: ` ${dto.email.toUpperCase()} `,
        password: dto.password,
      }),
    ).expect(409);
  });

  it('should never include the password hash in a response body', async () => {
    const dto = generateMockRegisterDto();
    registeredEmails.push(dto.email);

    const responses = [await register(dto), await register(dto)];

    for (const { text } of responses) {
      expect(text).not.toMatch(/passwordHash/i);
      expect(text).not.toContain('$argon2');
    }
  });

  it.each([
    [
      'a password without an uppercase letter',
      { password: generateMockPassword().toLowerCase() },
    ],
    [
      'a password without a lowercase letter',
      { password: generateMockPassword().toUpperCase() },
    ],
    [
      'a password without a digit',
      { password: generateMockPassword().replace(/\d/g, 'x') },
    ],
    [
      'a password shorter than 9 characters',
      { password: generateMockPassword(8) },
    ],
    ['an invalid email', { email: generateRandomString() }],
    ['a client-chosen role', { role: Role.ADMIN }],
  ])('should respond 400 for %s', async (_, override) => {
    const dto = Object.assign(generateMockRegisterDto(), override);
    registeredEmails.push(dto.email);

    await register(dto).expect(400);
  });
});
