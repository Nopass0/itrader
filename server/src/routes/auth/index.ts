import { Elysia, t } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { loginHandler } from './login';
import { registerHandler } from './register';

const prisma = new PrismaClient();

export function authRoutes(app: Elysia): Elysia {
  return app
    .post('/login', loginHandler, {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      detail: {
        summary: 'Authenticate user',
        description: 'Login a user and generate an auth token',
        tags: ['Auth'],
      },
    })
    .post('/register', registerHandler, {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        adminToken: t.String(),
      }),
      detail: {
        summary: 'Register new user',
        description: 'Register a new user with an admin token',
        tags: ['Auth'],
      },
    });
}