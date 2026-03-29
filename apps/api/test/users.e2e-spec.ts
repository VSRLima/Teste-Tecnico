import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetDatabase, seedUsers, seededUsers } from './helpers/test-database';

describe('UsersModule (e2e)', () => {
  it('allows admins to manage users and blocks non-admin access', async () => {
    const setup = await createTestApp();
    const httpServer = setup.app.getHttpServer();

    try {
      await resetDatabase(setup.prisma);
      await seedUsers(setup.prisma);

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

      const listUsersResponse = await request(httpServer)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`);

      expect(listUsersResponse.status).toBe(200);
      expect(listUsersResponse.body).toHaveLength(3);
      expect(listUsersResponse.body[0]).not.toHaveProperty('passwordHash');

      const forbiddenListResponse = await request(httpServer)
        .get('/api/users')
        .set(
          'Authorization',
          `Bearer ${managerLoginResponse.body.accessToken}`,
        );

      expect(forbiddenListResponse.status).toBe(403);

      const createUserResponse = await request(httpServer)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`)
        .send({
          name: 'Support Analyst',
          email: 'support@test.com',
          password: 'Supp0rt@123',
          role: 'MANAGER',
        });

      expect(createUserResponse.status).toBe(201);
      expect(createUserResponse.body).toEqual(
        expect.objectContaining({
          email: 'support@test.com',
          name: 'Support Analyst',
          role: 'MANAGER',
        }),
      );

      const createdUserId = createUserResponse.body.id as string;

      const updateUserResponse = await request(httpServer)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`)
        .send({
          name: 'Support Updated',
          role: 'USER',
        });

      expect(updateUserResponse.status).toBe(200);
      expect(updateUserResponse.body).toEqual(
        expect.objectContaining({
          id: createdUserId,
          name: 'Support Updated',
          role: 'USER',
        }),
      );

      const selfUpdateResponse = await request(httpServer)
        .patch(`/api/users/${seededUsers.admin.id}`)
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`)
        .send({
          role: 'MANAGER',
        });

      expect(selfUpdateResponse.status).toBe(403);

      const deleteUserResponse = await request(httpServer)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`);

      expect(deleteUserResponse.status).toBe(200);
      expect(deleteUserResponse.body).toEqual({
        message: 'User deleted successfully',
      });

      const selfDeleteResponse = await request(httpServer)
        .delete(`/api/users/${seededUsers.admin.id}`)
        .set('Authorization', `Bearer ${adminLoginResponse.body.accessToken}`);

      expect(selfDeleteResponse.status).toBe(403);
    } finally {
      await setup.app.close();
    }
  });
});
