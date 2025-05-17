import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { setupRoutes } from './setupRoutes';
import { setupSessions } from './services/sessions';

// Create the main Elysia app
const app = new Elysia()
  .use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token']
  }))
  .use(swagger({
    path: '/swagger',
    documentation: {
      info: {
        title: 'iTrader API',
        version: '1.0.0',
        description: 'API for iTrader platform',
      },
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Gate.cx', description: 'Gate.cx integration endpoints' },
        { name: 'Bybit', description: 'Bybit integration endpoints' },
        { name: 'Admin', description: 'Admin endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  }))
  // Create route aliases for Swagger
  .get('/docs', () => Bun.redirect('/swagger'))
  .get('/api-docs', () => Bun.redirect('/swagger'))
  .options('/swagger', ({ set }) => {
    // Handle preflight requests for swagger
    set.headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
      'Content-Type': 'application/json'
    };
    return null;
  })
  .use(jwt({
    name: 'jwt',
    secret: config.jwtSecret,
  }))
  .use(authMiddleware)
  .get('/', () => '🤖 iTrader API is running!')
  .options('/health', ({ set }) => {
    // Handle preflight requests
    set.headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
      'Content-Type': 'application/json'
    };
    return null;
  })
  .get('/health', ({ set }) => {
    // Set required headers for CORS
    set.headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json'
    };

    return {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

// Register all routes
setupRoutes(app);

// Add a catchall route to handle 404s
app.all('*', ({ path }) => {
  logger.warn(`No route found for: ${path}`);
  return {
    success: false,
    error: 'Route not found',
    status: 404
  };
});

// Create HTTP server and add headers adapter for compatibility
const originalFetch = app.fetch;
app.fetch = async (req) => {
  try {
    // Add a get method to headers object if it doesn't exist
    if (req.headers && typeof req.headers === 'object' && !req.headers.get) {
      req.headers.get = function(name) {
        return this[name.toLowerCase()];
      };
      // Add a toJSON method to headers object
      req.headers.toJSON = function() {
        return { ...this };
      };
    }
    return await originalFetch(req);
  } catch (error) {
    // Handle 404 errors more gracefully
    if (error.status === 404 || error.code === 'NOT_FOUND') {
      logger.warn(`Route not found: ${req.url}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Route not found',
        status: 404
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Rethrow other errors
    throw error;
  }
};

// Create HTTP server and Socket.IO instance
const httpServer = createServer(app.fetch);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const port = config.port;

// Explicitly bind to 0.0.0.0 to listen on all interfaces
httpServer.listen(port, '0.0.0.0', () => {
  logger.info(`
╭───────────────────────────────────────────────────╮
│ ✻ AI Trader API Server                           │
│                                                   │
│   Server running at http://localhost:${port}        │
│   Swagger docs at http://localhost:${port}/swagger  │
│                                                   │
╰───────────────────────────────────────────────────╯
  `);

  // Setup sessions for Gate.cx and Bybit
  setupSessions().catch(err => {
    logger.error('Failed to setup sessions:', err);
  });
});

// Handle any server errors to prevent hanging
httpServer.on('error', (err) => {
  logger.error('Server error:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Ensure logs are properly written on exit
process.on('SIGINT', async () => {
  logger.info('Server shutting down...');
  await logger.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Server terminating...');
  await logger.shutdown();
  process.exit(0);
});

// Export the app for testing
export { app };