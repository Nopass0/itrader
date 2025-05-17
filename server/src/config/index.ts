import { createEnv } from './env';

// Load environment variables
const env = createEnv();

export const config = {
  port: env.PORT || 3000,
  environment: env.NODE_ENV || 'development',
  jwtSecret: env.JWT_SECRET || 'ai-trader-secret-key-change-in-production',
  jwtExpiration: env.JWT_EXPIRATION || '1d',

  // Database
  database: {
    url: env.DATABASE_URL,
  },

  // CORS
  corsOrigins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],

  // Gate.cx
  gatecx: {
    apiUrl: env.GATE_API_URL || 'https://panel.gate.cx/api/v1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },

  // Bybit
  bybit: {
    apiUrl: env.BYBIT_API_URL || 'https://api.bybit.com',
    testnetApiUrl: env.BYBIT_TESTNET_API_URL || 'https://api-testnet.bybit.com',
    useTestnet: env.BYBIT_USE_TESTNET === 'true',
    recvWindow: 5000,
  },

  // Logger
  logger: {
    level: env.LOG_LEVEL || 'info',
  },

  // Admin
  adminToken: env.ADMIN_TOKEN,

  // Session refresh interval in minutes
  sessionRefreshInterval: parseInt(env.SESSION_REFRESH_INTERVAL || '30', 10),

  // Development mode settings
  allowDevAccess: env.ALLOW_DEV_ACCESS === 'true',

  // Mock data
  useMockData: env.USE_MOCK_DATA === 'true',
};