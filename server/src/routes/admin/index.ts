import { Elysia, t } from 'elysia';
import { createUserHandler } from './createUser';
import { usersHandler } from './users';
import { configHandler } from './config';

export function adminRoutes(app: Elysia): Elysia {
  return app
    .get('/users', usersHandler, {
      detail: {
        summary: 'Get all users',
        description: 'Retrieve information about all users',
        tags: ['Admin'],
      },
    })
    .post('/users', createUserHandler, {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        gateCredentials: t.Optional(t.Object({
          email: t.String(),
          password: t.String(),
        })),
        bybitCredentials: t.Optional(t.Object({
          apiKey: t.String(),
          apiSecret: t.String(),
        })),
      }),
      detail: {
        summary: 'Create user',
        description: 'Create a new user with optional platform credentials',
        tags: ['Admin'],
      },
    })
    .get('/config', configHandler, {
      detail: {
        summary: 'Get server configuration',
        description: 'Retrieve server configuration information',
        tags: ['Admin'],
      },
    });
}