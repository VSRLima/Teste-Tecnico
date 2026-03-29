import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import {
  resetDatabase,
  seedCampaignFixtures,
  seedUsers,
  seededUsers,
} from './helpers/test-database';

describe('CampaignsModule (e2e)', () => {
  it('executes campaign CRUD and authorization rules against the real API', async () => {
    const setup = await createTestApp();
    const httpServer = setup.app.getHttpServer();

    await resetDatabase(setup.prisma);
    await seedUsers(setup.prisma);
    await seedCampaignFixtures(setup.prisma);

    const adminLoginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: seededUsers.admin.email,
        password: seededUsers.admin.password,
      });
    const managerLoginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: seededUsers.manager.email,
        password: seededUsers.manager.password,
      });
    const managerTwoLoginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: seededUsers.managerTwo.email,
        password: seededUsers.managerTwo.password,
      });

    const listAsAdminResponse = await request(httpServer)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`);

    expect(listAsAdminResponse.status).toBe(200);
    expect(listAsAdminResponse.body).toHaveLength(2);

    const listAsManagerResponse = await request(httpServer)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`);

    expect(listAsManagerResponse.status).toBe(200);
    expect(listAsManagerResponse.body).toHaveLength(1);
    expect(listAsManagerResponse.body[0].name).toBe('Campaign One');

    const createResponse = await request(httpServer)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`)
      .send({
        name: 'Black Friday',
        description: 'Promo campaign',
        budget: 2500.5,
        startDate: '2099-11-01T00:00:00.000Z',
        endDate: '2099-11-30T23:59:59.000Z',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        name: 'Black Friday',
        status: 'DRAFT',
        ownerId: seededUsers.manager.id,
      }),
    );

    const duplicateResponse = await request(httpServer)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`)
      .send({
        name: 'Campaign One',
        budget: 1000,
        startDate: '2099-11-01T00:00:00.000Z',
      });

    expect(duplicateResponse.status).toBe(409);

    const createdCampaignId = createResponse.body.id as string;

    const getOwnCampaignResponse = await request(httpServer)
      .get(`/api/campaigns/${createdCampaignId}`)
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`);

    expect(getOwnCampaignResponse.status).toBe(200);
    expect(getOwnCampaignResponse.body.name).toBe('Black Friday');

    const managerTwoCampaign = listAsAdminResponse.body.find(
      (campaign: { name: string }) => campaign.name === 'Campaign Two',
    ) as { id: string } | undefined;

    expect(managerTwoCampaign).toBeDefined();

    if (!managerTwoCampaign) {
      throw new Error('Expected seeded campaign "Campaign Two" to exist');
    }

    const forbiddenReadResponse = await request(httpServer)
      .get(`/api/campaigns/${managerTwoCampaign.id}`)
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`);

    expect(forbiddenReadResponse.status).toBe(403);

    const forbiddenUpdateResponse = await request(httpServer)
      .patch(`/api/campaigns/${managerTwoCampaign.id}`)
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`)
      .send({
        name: 'Forbidden update',
      });

    expect(forbiddenUpdateResponse.status).toBe(403);

    const updateResponse = await request(httpServer)
      .patch(`/api/campaigns/${createdCampaignId}`)
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`)
      .send({
        name: 'Black Friday Updated',
        status: 'PAUSED',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        id: createdCampaignId,
        name: 'Black Friday Updated',
        status: 'PAUSED',
      }),
    );

    const removeForbiddenResponse = await request(httpServer)
      .delete(`/api/campaigns/${createdCampaignId}`)
      .set(
        'Authorization',
        `Bearer ${managerTwoLoginResponse.body.accessToken}`,
      );

    expect(removeForbiddenResponse.status).toBe(403);

    const removeResponse = await request(httpServer)
      .delete(`/api/campaigns/${createdCampaignId}`)
      .set('Authorization', `Bearer ${managerLoginResponse.body.accessToken}`);

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body).toEqual({
      message: 'Campaign deleted successfully',
    });

    const notFoundResponse = await request(httpServer)
      .get('/api/campaigns/non-existent-id')
      .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`);

    expect(notFoundResponse.status).toBe(404);

    await setup.app.close();
  });
});
