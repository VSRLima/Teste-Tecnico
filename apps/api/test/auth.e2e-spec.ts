import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetDatabase, seedUsers, seededUsers } from './helpers/test-database';

describe('AuthModule (e2e)', () => {
  it('authenticates, refreshes and authorizes user creation flows', async () => {
    const setup = await createTestApp();
    const httpServer = setup.app.getHttpServer();
    const managerAgent = request.agent(httpServer);

    await resetDatabase(setup.prisma);
    await seedUsers(setup.prisma);

    const loginResponse = await managerAgent.post('/api/auth/login').send({
      email: seededUsers.manager.email,
      password: seededUsers.manager.password,
    });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));

    const refreshResponse = await managerAgent
      .post('/api/auth/refresh')
      .send({});

    expect(refreshResponse.status).toBe(201);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));

    const invalidLoginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: seededUsers.manager.email,
        password: 'wrong-password',
      });

    expect(invalidLoginResponse.status).toBe(401);

    const adminLoginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: seededUsers.admin.email,
        password: seededUsers.admin.password,
      });

    const adminRegisterResponse = await request(httpServer)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`)
      .send({
        name: 'Second User',
        email: 'second-user@test.com',
        password: 'Admin@123',
      });

    expect(adminRegisterResponse.status).toBe(201);
    expect(adminRegisterResponse.body.accessToken).toEqual(expect.any(String));
    expect(adminRegisterResponse.body.refreshToken).toEqual(expect.any(String));

    const managerRegisterResponse = await request(httpServer)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({
        name: 'Blocked Manager',
        email: 'blocked@test.com',
        password: 'Manager@123',
      });

    expect(managerRegisterResponse.status).toBe(403);

    const unauthenticatedRegisterResponse = await request(httpServer)
      .post('/api/auth/register')
      .send({
        name: 'No Token',
        email: 'no-token@test.com',
        password: 'Manager@123',
      });

    expect(unauthenticatedRegisterResponse.status).toBe(401);

    const duplicateRegisterResponse = await request(httpServer)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`)
      .send({
        name: 'Duplicated Manager',
        email: seededUsers.manager.email,
        password: 'Manager@123',
      });

    expect(duplicateRegisterResponse.status).toBe(409);

    await setup.app.close();
  });
});
