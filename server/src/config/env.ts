export function createEnv() {
  return {
    // Server
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION,

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // CORS
    CORS_ORIGINS: process.env.CORS_ORIGINS,

    // Gate.cx
    GATE_API_URL: process.env.GATE_API_URL,

    // Bybit
    BYBIT_API_URL: process.env.BYBIT_API_URL,
    BYBIT_TESTNET_API_URL: process.env.BYBIT_TESTNET_API_URL,
    BYBIT_USE_TESTNET: process.env.BYBIT_USE_TESTNET,

    // Logger
    LOG_LEVEL: process.env.LOG_LEVEL,

    // Admin
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,

    // Session refresh interval
    SESSION_REFRESH_INTERVAL: process.env.SESSION_REFRESH_INTERVAL,

    // Development mode
    ALLOW_DEV_ACCESS: process.env.ALLOW_DEV_ACCESS,

    // Mock data for testing
    USE_MOCK_DATA: process.env.USE_MOCK_DATA,
  };
}