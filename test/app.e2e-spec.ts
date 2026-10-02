import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { GracefulShutdownService } from './../src/core/shutdown/graceful-shutdown.service';

/**
 * Khởi động AppModule thật (toàn bộ CoreModule: DI graph, middleware, guard/interceptor toàn cục)
 * với DataSource giả lập để chạy được mà không cần PostgreSQL/Redis.
 */
describe('AppModule bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  const fakeDataSource = {
    isInitialized: false,
    subscribers: [],
    manager: {},
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(fakeDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('GET / should respond and attach a correlation id', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);

    expect(res.text).toBe('Hello World!');
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should echo a well-formed incoming request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('x-request-id', 'client-trace-12345')
      .expect(200);

    expect(res.headers['x-correlation-id']).toBe('client-trace-12345');
  });

  it('should apply ONLY the public throttle tier by default and return 429 past the limit', async () => {
    const server = app.getHttpServer();
    const first = await request(server).get('/').expect(200);

    expect(first.headers['x-ratelimit-limit-public']).toBe('3');
    expect(first.headers['x-ratelimit-limit-sensitive']).toBeUndefined();

    await request(server).get('/').expect(200);
    await request(server).get('/').expect(200);
    await request(server).get('/').expect(429);
  });

  it('should register the TypeORM tenancy subscriber on the DataSource', () => {
    expect(fakeDataSource.subscribers.length).toBeGreaterThan(0);
  });

  it('should run the shutdown sequence and flip readiness', async () => {
    const shutdown = app.get(GracefulShutdownService);
    await app.close();
    expect(shutdown.isShuttingDown()).toBe(true);
    app = undefined as unknown as INestApplication<App>;
  });
});
