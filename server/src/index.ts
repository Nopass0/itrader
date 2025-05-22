import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { accountManager } from './services/accountService.js';
import { sessionManager } from './services/sessionManager.js';
import { realGateService } from './services/realGateService.js';
import { websocketService } from './services/websocketService.js';
import { gateDataSyncService } from './services/gateDataSyncService.js';
import { proxyManager } from './services/proxyManager.js';
import { proxyService } from './services/proxyService.js';
import { transactionMonitor } from './services/transactionMonitor.js';
import { bybitAccountService } from './services/bybitAccountService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize demo user if it doesn't exist
async function initializeDemoUser() {
  try {
    // Check if demo user exists
    const existingUser = await prisma.user.findFirst({
      where: { username: 'demo' }
    });

    if (!existingUser) {
      // Create demo admin first
      const admin = await prisma.admin.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          username: 'admin',
          password: 'admin123',
          token: 'demo_admin_token'
        }
      });

      // Create demo user
      await prisma.user.create({
        data: {
          username: 'demo',
          password: 'demo123',
          adminId: admin.id
        }
      });

      console.log('Demo user initialized');
    }
  } catch (error) {
    console.error('Error initializing demo user:', error);
  }
}

// Initialize demo user on startup
initializeDemoUser();

// Initialize proxy management system
proxyManager.initialize().catch(console.error);

// Start session manager for automatic re-authentication
sessionManager.start();

// Start Gate data sync service
gateDataSyncService.start();

// Environment variables with defaults
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'];

console.log('🚀 Starting AI Trader Server...');
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', NODE_ENV);
console.log('🔗 CORS Origins:', CORS_ORIGINS);

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: 'AI Trader API is running!'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🤖 AI Trader API is running!',
    version: '1.0.0',
    endpoints: [
      '/health - Health check',
      '/api/auth - Authentication',
      '/api/gate - Gate.cx integration',
      '/api/bybit - Bybit integration',
      '/api/admin - Admin endpoints'
    ]
  });
});

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username });
  
  // Simple auth for demo
  if (username === 'admin' && password === 'admin123') {
    const token = 'demo_token_' + Date.now();
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
      },
      error: null
    });
  } else {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  
  console.log('Registration attempt:', { username, email });
  
  // Simple registration for demo
  if (username && email && password) {
    const token = 'demo_token_' + Date.now();
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: Date.now(),
          username,
          email,
          role: 'user'
        }
      },
      error: null
    });
  } else {
    res.status(400).json({
      success: false,
      data: null,
      error: 'Missing required fields'
    });
  }
});

// Helper function to get authenticated user
const getAuthenticatedUser = (req: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-api-token'];
  
  if (token && token.startsWith('demo_token_')) {
    return {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    };
  }
  
  return null;
};

app.get('/api/auth/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  
  if (user) {
    res.json({
      success: true,
      data: user,
      error: null
    });
  } else {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid token'
    });
  }
});

// Gate.cx routes
app.get('/api/gate/accounts', async (req, res) => {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    const accounts = await prisma.gateCredentials.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const accountsWithInfo = await Promise.all(
      accounts.map(async (account) => {
        let additionalInfo = {};
        
        if (account.status === 'active') {
          try {
            additionalInfo = await accountManager.getAccountInfo('gate', {
              email: account.email,
              password: account.password
            });
          } catch (error) {
            // If we can't get info, just continue without it
          }
        }

        return {
          id: account.id,
          email: account.email,
          status: account.status,
          errorMessage: account.errorMessage,
          lastCheckAt: account.lastCheckAt,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          user: account.user,
          ...additionalInfo
        };
      })
    );

    res.json({
      success: true,
      data: {
        items: accountsWithInfo,
        meta: {
          total: accountsWithInfo.length
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/gate/accounts', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Email and password are required'
      });
    }

    const userId = user.id;

    const account = await prisma.gateCredentials.create({
      data: {
        userId,
        email,
        password,
        status: 'initializing'
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    // Initialize account in background
    accountManager.initializeAccount('gate', account.id, { email, password })
      .catch(console.error);

    res.json({
      success: true,
      data: account,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.delete('/api/gate/accounts/:id', async (req, res) => {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    const accountId = parseInt(req.params.id);
    
    // Verify the account belongs to the user
    const account = await prisma.gateCredentials.findFirst({
      where: { 
        id: accountId,
        userId: user.id 
      }
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found or access denied'
      });
    }
    
    await prisma.gateCredentials.delete({
      where: { id: accountId }
    });

    res.json({
      success: true,
      data: { message: 'Account deleted successfully' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/gate/transactions', (req, res) => {
  res.json({
    success: true,
    data: {
      items: [
        {
          id: 1,
          type: 'buy',
          symbol: 'BTC/USDT',
          amount: '0.001',
          price: '45000.00',
          total: '45.00',
          fee: '0.045',
          timestamp: new Date().toISOString()
        }
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        has_next: false
      }
    },
    error: null
  });
});

// Bybit routes
app.get('/api/bybit/accounts', async (req, res) => {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    const accounts = await prisma.bybitCredentials.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const accountsWithInfo = await Promise.all(
      accounts.map(async (account) => {
        let additionalInfo = {};
        
        if (account.status === 'active') {
          try {
            additionalInfo = await accountManager.getAccountInfo('bybit', {
              apiKey: account.apiKey,
              apiSecret: account.apiSecret
            });
          } catch (error) {
            // If we can't get info, just continue without it
          }
        }

        return {
          id: account.id,
          apiKey: account.apiKey.substring(0, 8) + '...',
          status: account.status,
          errorMessage: account.errorMessage,
          lastCheckAt: account.lastCheckAt,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          user: account.user,
          ...additionalInfo
        };
      })
    );

    res.json({
      success: true,
      data: {
        items: accountsWithInfo,
        meta: {
          total: accountsWithInfo.length
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/accounts', async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;
    
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'API key and API secret are required'
      });
    }

    const userId = user.id;

    const account = await prisma.bybitCredentials.create({
      data: {
        userId,
        apiKey,
        apiSecret,
        status: 'initializing'
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    // Initialize account in background
    accountManager.initializeAccount('bybit', account.id, { apiKey, apiSecret })
      .catch(console.error);

    res.json({
      success: true,
      data: {
        ...account,
        apiKey: account.apiKey.substring(0, 8) + '...'
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.delete('/api/bybit/accounts/:id', async (req, res) => {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required'
      });
    }
    
    const accountId = parseInt(req.params.id);
    
    // Verify the account belongs to the user
    const account = await prisma.bybitCredentials.findFirst({
      where: { 
        id: accountId,
        userId: user.id 
      }
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found or access denied'
      });
    }
    
    await prisma.bybitCredentials.delete({
      where: { id: accountId }
    });

    res.json({
      success: true,
      data: { message: 'Account deleted successfully' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/bybit/transactions', (req, res) => {
  res.json({
    success: true,
    data: {
      items: [
        {
          id: 1,
          type: 'sell',
          symbol: 'ETH/USDT',
          amount: '0.1',
          price: '2500.00',
          total: '250.00',
          fee: '0.25',
          timestamp: new Date().toISOString()
        }
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        has_next: false
      }
    },
    error: null
  });
});

// Admin routes
app.get('/api/admin/users', (req, res) => {
  res.json({
    success: true,
    data: {
      items: [
        {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString()
        }
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        has_next: false
      }
    },
    error: null
  });
});

// Stats endpoint for dashboard
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      total_users: 1,
      gate_accounts: 1,
      bybit_accounts: 1,
      total_transactions: 2,
      total_volume: '295.00 USDT'
    },
    error: null
  });
});

// Gate.cx data endpoints
app.get('/api/gate/accounts/:id/transactions', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const status = req.query.status as string;
    const wallet = req.query.wallet as string;
    const transactionId = req.query.transaction_id as string;

    // Get account credentials
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Parse filters
    const filters: any = {};
    if (status) {
      filters.status = status.split(',').map(s => parseInt(s.trim()));
    }
    if (wallet) {
      filters.wallet = wallet;
    }
    if (transactionId) {
      filters.id = transactionId;
    }

    const result = await realGateService.getTransactions(account.userId, page, filters);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        data: null,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        items: result.data!.transactions,
        meta: {
          page: result.data!.pagination.current_page,
          limit: result.data!.pagination.per_page,
          total: result.data!.pagination.total,
          has_next: result.data!.pagination.has_next
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/gate/accounts/:id/sms', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const status = req.query.status ? parseInt(req.query.status as string) : undefined;

    // Get account credentials
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const result = await realGateService.getSmsMessages(account.userId, page, status);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        data: null,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        items: result.data!.messages.map(msg => ({
          id: msg.id,
          from: msg.from,
          text: msg.text,
          status: msg.status,
          received_at: msg.received_at,
          created_at: msg.created_at,
          device_id: msg.device.id,
          device_name: msg.device.name,
          additional_fields: {
            parsed: msg.parsed
          }
        })),
        meta: {
          page: result.data!.pagination.current_page,
          limit: result.data!.pagination.per_page,
          total: result.data!.pagination.total,
          has_next: result.data!.pagination.has_next
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/gate/accounts/:id/push', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const status = req.query.status ? parseInt(req.query.status as string) : undefined;

    // Get account credentials
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const result = await realGateService.getPushNotifications(account.userId, page, status);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        data: null,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        items: result.data!.notifications.map(notification => ({
          id: notification.id,
          package_name: notification.package_name,
          title: notification.title,
          text: notification.text,
          status: notification.status,
          received_at: notification.received_at,
          created_at: notification.created_at,
          device_id: notification.device.id,
          device_name: notification.device.name,
          has_parsed_data: !!notification.parsed,
          additional_fields: {
            parsed: notification.parsed
          }
        })),
        meta: {
          page: result.data!.pagination.current_page,
          limit: result.data!.pagination.per_page,
          total: result.data!.pagination.total,
          has_next: result.data!.pagination.has_next
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get Gate dashboard stats
app.get('/api/gate/accounts/:id/dashboard/:stepType', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const stepType = req.params.stepType;

    // Get account to verify ownership
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Get dashboard stats from database
    console.log(`[Dashboard API] Looking for stats: userId=${account.userId}, stepType=${stepType}`);
    
    const stats = await prisma.gateDashboardStats.findUnique({
      where: {
        userId_stepType: {
          userId: account.userId,
          stepType: stepType
        }
      }
    });

    console.log(`[Dashboard API] Found stats:`, !!stats);

    if (!stats) {
      // Try to find any stats for this user
      const allUserStats = await prisma.gateDashboardStats.findMany({
        where: { userId: account.userId }
      });
      console.log(`[Dashboard API] Available stepTypes for user ${account.userId}:`, allUserStats.map(s => s.stepType));
      
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Dashboard stats not found'
      });
    }

    res.json({
      success: true,
      data: {
        graph: stats.graphData,
        avg: stats.avgData,
        stepType: stats.stepType,
        lastUpdated: stats.updatedAt
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get all stored transactions for an account
app.get('/api/gate/accounts/:id/stored-transactions', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    // Get account to verify ownership
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Build filters
    const where: any = { userId: account.userId };
    if (search) {
      where.OR = [
        { gateId: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
        { currency: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.gateTransaction.count({ where });

    // Get transactions
    const transactions = await prisma.gateTransaction.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({
      success: true,
      data: {
        items: transactions,
        meta: {
          page,
          limit,
          total,
          has_next: page * limit < total
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get all stored SMS messages for an account
app.get('/api/gate/accounts/:id/stored-sms', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    // Get account
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Build filters
    const where: any = { userId: account.userId };
    if (search) {
      where.OR = [
        { from: { contains: search } },
        { text: { contains: search, mode: 'insensitive' } }
      ];
    }

    const total = await prisma.gateSms.count({ where });
    const messages = await prisma.gateSms.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({
      success: true,
      data: {
        items: messages,
        meta: {
          page,
          limit,
          total,
          has_next: page * limit < total
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get all stored push notifications for an account
app.get('/api/gate/accounts/:id/stored-push', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    // Get account
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Build filters
    const where: any = { userId: account.userId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { text: { contains: search, mode: 'insensitive' } },
        { packageName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const total = await prisma.gatePush.count({ where });
    const notifications = await prisma.gatePush.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({
      success: true,
      data: {
        items: notifications,
        meta: {
          page,
          limit,
          total,
          has_next: page * limit < total
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Trigger manual sync for an account
app.post('/api/gate/accounts/:id/sync', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Get account
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Trigger sync
    await gateDataSyncService.triggerSync(account.userId);

    res.json({
      success: true,
      data: { message: 'Sync triggered successfully' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get account balance
app.get('/api/gate/accounts/:id/balance', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Get account to verify ownership
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const result = await realGateService.getAccountBalance(account.userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        data: null,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get account total counts (transactions, SMS, push notifications)
app.get('/api/gate/accounts/:id/stats', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Get account to verify ownership
    const account = await prisma.gateCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Get total counts for each data type and transaction status counts
    const [transactionCount, smsCount, pushCount, pendingTransactionCount, inProcessTransactionCount] = await Promise.all([
      prisma.gateTransaction.count({
        where: { userId: account.userId }
      }),
      prisma.gateSms.count({
        where: { userId: account.userId }
      }),
      prisma.gatePush.count({
        where: { userId: account.userId }
      }),
      // Status 1 = "Ожидает" (pending)
      prisma.gateTransaction.count({
        where: { 
          userId: account.userId,
          status: 1
        }
      }),
      // Status 5 = "Ожидает подтверждения" (in-process)
      prisma.gateTransaction.count({
        where: { 
          userId: account.userId,
          status: 5
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalTransactions: transactionCount,
        totalSms: smsCount,
        totalPush: pushCount,
        pendingTransactions: pendingTransactionCount,
        inProcessTransactions: inProcessTransactionCount,
        accountId: accountId,
        userId: account.userId
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Session management endpoints
app.get('/api/gate/sessions/status', async (req, res) => {
  try {
    const status = await sessionManager.getSessionStatus();
    res.json({
      success: true,
      data: status,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/gate/accounts/:id/refresh', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const success = await sessionManager.refreshAccountNow(accountId);
    
    if (success) {
      res.json({
        success: true,
        data: { message: 'Session refreshed successfully' },
        error: null
      });
    } else {
      res.status(500).json({
        success: false,
        data: null,
        error: 'Failed to refresh session'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Bybit P2P endpoints
app.get('/api/bybit/accounts/:id/balances', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const balances = await bybitAccountService.getAccountBalances(accountId);

    res.json({
      success: true,
      data: balances,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/bybit/accounts/:id/ads', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const ads = await bybitAccountService.getAccountAds(accountId);

    res.json({
      success: true,
      data: ads,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/bybit/accounts/:id/orders', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const orders = await bybitAccountService.getAccountOrders(accountId);

    res.json({
      success: true,
      data: orders,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/accounts/:id/ads', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const adData = req.body;
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const result = await bybitAccountService.createAd(accountId, adData);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.put('/api/bybit/accounts/:id/ads', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const adData = req.body;
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const result = await bybitAccountService.updateAd(accountId, adData);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.delete('/api/bybit/ads/:adId', async (req, res) => {
  try {
    const adId = req.params.adId;
    
    // Find the ad to get user info
    const ad = await prisma.bybitP2PAd.findUnique({
      where: { id: adId }
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Ad not found'
      });
    }

    const result = await bybitAccountService.removeAd(accountId, adId);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/orders/:orderId/pay', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Find the order to get user info
    const order = await prisma.bybitP2POrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Order not found'
      });
    }

    // Find the user's Bybit account
    const account = await prisma.bybitCredentials.findFirst({
      where: { userId: order.userId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No Bybit account found for this user'
      });
    }

    const result = await bybitAccountService.markOrderAsPaid(account.id, orderId);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/orders/:orderId/release', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Find the order to get user info
    const order = await prisma.bybitP2POrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Order not found'
      });
    }

    // Find the user's Bybit account
    const account = await prisma.bybitCredentials.findFirst({
      where: { userId: order.userId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No Bybit account found for this user'
      });
    }

    const result = await bybitAccountService.releaseDigitalAsset(account.id, orderId);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.get('/api/bybit/orders/:orderId/chat', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Find the order to get user info
    const order = await prisma.bybitP2POrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Order not found'
      });
    }

    // Find the user's Bybit account
    const account = await prisma.bybitCredentials.findFirst({
      where: { userId: order.userId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No Bybit account found for this user'
      });
    }

    const result = await bybitAccountService.getChatMessages(account.id, orderId);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/orders/:orderId/chat', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { content } = req.body;
    
    // Find the order to get user info
    const order = await prisma.bybitP2POrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Order not found'
      });
    }

    // Find the user's Bybit account
    const account = await prisma.bybitCredentials.findFirst({
      where: { userId: order.userId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No Bybit account found for this user'
      });
    }

    const result = await bybitAccountService.sendChatMessage(account.id, orderId, content);

    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/bybit/accounts/:id/sync', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    await bybitAccountService.syncAccountData(accountId);

    res.json({
      success: true,
      data: { message: 'Sync completed' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get user info for account
app.get('/api/bybit/accounts/:id/user-info', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const userInfo = await bybitAccountService.getUserInfo(accountId);

    res.json({
      success: true,
      data: userInfo,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get payment methods for account
app.get('/api/bybit/accounts/:id/payment-methods', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    const paymentMethods = await bybitAccountService.getPaymentMethods(accountId);

    res.json({
      success: true,
      data: paymentMethods,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    data: null,
    error: 'Route not found'
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    data: null,
    error: 'Internal server error'
  });
});

// Create HTTP server and Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize WebSocket service
websocketService.initialize(io);

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Join user-specific rooms for targeted updates
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`🔌 Socket ${socket.id} joined user room: user_${userId}`);
  });

  // Join account-specific rooms
  socket.on('join_account_room', (accountId, platform) => {
    socket.join(`account_${platform}_${accountId}`);
    console.log(`🔌 Socket ${socket.id} joined account room: account_${platform}_${accountId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Send periodic stats updates
setInterval(() => {
  websocketService.broadcastStatsUpdate();
}, 10000); // Every 10 seconds

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╭───────────────────────────────────────────────────╮
│ ✨ AI Trader Server Started Successfully!        │
│                                                   │
│   🌐 Server: http://localhost:${PORT}               │
│   🏥 Health: http://localhost:${PORT}/health        │
│   📚 API Base: http://localhost:${PORT}/api         │
│                                                   │
│   Environment: ${NODE_ENV}                          │
│   CORS Origins: ${CORS_ORIGINS.join(', ')}          │
│                                                   │
╰───────────────────────────────────────────────────╯
  `);

  // Start transaction monitoring service
  console.log('🔍 Starting transaction monitor service...');
  transactionMonitor.start();
});

// Proxy management endpoints
app.get('/api/proxy/status', async (req, res) => {
  try {
    const status = await proxyManager.getStatus();
    res.json({
      success: true,
      data: status,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/proxy/add', async (req, res) => {
  try {
    const { host, port, username, password, protocol, country } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Host and port are required'
      });
    }

    const proxyId = await proxyManager.addCustomProxy(host, parseInt(port), {
      username,
      password,
      protocol: protocol || 'socks5',
      country
    });

    if (proxyId) {
      res.json({
        success: true,
        data: { id: proxyId, message: 'Proxy added successfully' },
        error: null
      });
    } else {
      res.status(400).json({
        success: false,
        data: null,
        error: 'Proxy already exists or invalid'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/proxy/check', async (req, res) => {
  try {
    await proxyManager.forceProxyCheck();
    res.json({
      success: true,
      data: { message: 'Proxy check initiated' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/proxy/cleanup', async (req, res) => {
  try {
    const count = await proxyManager.cleanupOldProxies();
    res.json({
      success: true,
      data: { message: `Cleaned up ${count} failed proxies` },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Test specific proxy manually
app.post('/api/proxy/test/:id', async (req, res) => {
  try {
    const proxyId = parseInt(req.params.id);
    const result = await proxyService.testProxyManual(proxyId);
    
    res.json({
      success: true,
      data: result,
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Get detailed proxy list with IP verification status
app.get('/api/proxy/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const proxies = await prisma.proxy.findMany({
      skip,
      take: limit,
      orderBy: [
        { status: 'asc' },
        { successRate: 'desc' },
        { responseTime: 'asc' }
      ],
      select: {
        id: true,
        host: true,
        port: true,
        protocol: true,
        status: true,
        responseTime: true,
        successRate: true,
        verifiedIP: true,
        lastChecked: true,
        lastUsed: true,
        failureCount: true,
        successCount: true,
        source: true,
        country: true,
        notes: true
      }
    });

    const total = await prisma.proxy.count();

    res.json({
      success: true,
      data: {
        proxies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Transaction action endpoints
app.post('/api/gate/transactions/:id/action', async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { action } = req.body;

    if (!action || !['accept', 'reject', 'approve'].includes(action)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid action. Must be accept, reject, or approve'
      });
    }

    // Find the transaction by gateId
    const transaction = await prisma.gateTransaction.findUnique({
      where: { gateId: transactionId }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Transaction not found'
      });
    }

    // Get account credentials for Gate.cx API call
    const account = await prisma.gateCredentials.findFirst({
      where: { userId: transaction.userId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Account not found'
      });
    }

    // Perform the action via Gate.cx API
    const result = await realGateService.performTransactionAction(
      account.userId, 
      transactionId, 
      action
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        data: null,
        error: result.error
      });
    }

    // Update transaction status in database based on action
    let newStatus: number;
    let newStatusText: string;

    switch (action) {
      case 'accept':
        newStatus = 2; // Accepted
        newStatusText = 'Принят';
        break;
      case 'reject':
        newStatus = 3; // Rejected
        newStatusText = 'Отклонен';
        break;
      case 'approve':
        newStatus = 4; // Approved/Confirmed
        newStatusText = 'Подтвержден';
        break;
      default:
        newStatus = transaction.status;
        newStatusText = transaction.statusText || '';
    }

    // Update the transaction
    const updatedTransaction = await prisma.gateTransaction.update({
      where: { gateId: transactionId },
      data: {
        status: newStatus,
        statusText: newStatusText,
        updatedAt: new Date()
      }
    });

    // Notify via WebSocket
    websocketService.notifyTransactionActionCompleted(
      transaction.userId,
      transactionId,
      action,
      newStatus,
      newStatusText
    );

    res.json({
      success: true,
      data: {
        transaction: updatedTransaction,
        action,
        message: `Transaction ${action} successful`
      },
      error: null
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Transaction monitor endpoints
app.get('/api/transaction-monitor/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        isRunning: transactionMonitor.isMonitorRunning(),
        status: transactionMonitor.isMonitorRunning() ? 'running' : 'stopped'
      },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/transaction-monitor/start', async (req, res) => {
  try {
    transactionMonitor.start();
    res.json({
      success: true,
      data: { message: 'Transaction monitor started' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

app.post('/api/transaction-monitor/stop', async (req, res) => {
  try {
    transactionMonitor.stop();
    res.json({
      success: true,
      data: { message: 'Transaction monitor stopped' },
      error: null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  transactionMonitor.stop();
  proxyManager.shutdown().then(() => {
    server.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminating...');
  transactionMonitor.stop();
  proxyManager.shutdown().then(() => {
    server.close(() => {
      console.log('✅ Server terminated gracefully');
      process.exit(0);
    });
  });
});

export default app;