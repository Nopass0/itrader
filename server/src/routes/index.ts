import { Elysia } from 'elysia';
import { authRoutes } from './auth';
import { gateRoutes } from './gate';
import { bybitRoutes } from './bybit';
import { adminRoutes } from './admin';

export function setupRoutes(app: Elysia): void {
  // Register all route groups
  app.group('/auth', app => authRoutes(app));
  app.group('/gate', app => gateRoutes(app));
  app.group('/bybit', app => bybitRoutes(app));
  app.group('/admin', app => adminRoutes(app));
}