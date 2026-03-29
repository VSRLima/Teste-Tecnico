import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetDatabase } from './helpers/test-database';

describe('AppController (e2e)', () => {
  it('GET /api returns service health', async () => {
    const setup = await createTestApp();

    await resetDatabase(setup.prisma);

    const response = await request(setup.app.getHttpServer()).get('/api');

    expect(response.status).toBe(200);
    expect(response.text).toBe('DirectCash API is running');

    await setup.app.close();
  });
});
