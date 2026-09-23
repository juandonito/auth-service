import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  generateMockConfigService,
  type MockConfigService,
} from '../../../test/mock/config-service.mock';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prisma: PrismaService;
  let config: MockConfigService;

  beforeEach(async () => {
    config = generateMockConfigService();
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, { provide: ConfigService, useValue: config }],
    }).compile();

    prisma = moduleRef.get(PrismaService);
  });

  it('should read the connection string from DATABASE_URL', () => {
    expect(config.getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
  });

  it('should connect when the module initialises', async () => {
    const connect = jest.spyOn(prisma, '$connect').mockResolvedValue();

    await prisma.onModuleInit();

    expect(connect).toHaveBeenCalled();
  });

  it('should disconnect when the module is destroyed', async () => {
    const disconnect = jest.spyOn(prisma, '$disconnect').mockResolvedValue();

    await prisma.onModuleDestroy();

    expect(disconnect).toHaveBeenCalled();
  });
});
