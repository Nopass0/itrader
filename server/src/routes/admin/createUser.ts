import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route POST /admin/users
 * @description Create a new user with optional platform credentials
 * @body {Object} body - User data
 * @body {string} body.username - Username
 * @body {string} body.password - Password
 * @body {Object} [body.gateCredentials] - Gate.cx credentials
 * @body {string} body.gateCredentials.email - Gate.cx email
 * @body {string} body.gateCredentials.password - Gate.cx password
 * @body {Object} [body.bybitCredentials] - Bybit credentials
 * @body {string} body.bybitCredentials.apiKey - Bybit API key
 * @body {string} body.bybitCredentials.apiSecret - Bybit API secret
 * @returns {Object} Response - Created user
 */
export async function createUserHandler({ body, set, isAuthenticated, isAdmin, user }: any) {
  try {
    // Only admin users can create users
    if (!isAuthenticated || !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Admin privileges required',
        data: null,
      };
    }
    
    const { username, password, gateCredentials, bybitCredentials } = body;
    
    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: {
        username,
      },
    });
    
    if (existingUser) {
      set.status = 400;
      return {
        success: false,
        error: 'Username already exists',
        data: null,
      };
    }
    
    // Get the admin
    const admin = await prisma.admin.findFirst({
      where: isAdmin && user.id === 0 ? {} : { id: user.id },
    });
    
    if (!admin) {
      set.status = 400;
      return {
        success: false,
        error: 'Admin not found',
        data: null,
      };
    }
    
    // Create transaction to ensure all operations succeed or fail together
    const newUser = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          username,
          password, // In a real app, password should be hashed
          adminId: admin.id,
        },
      });
      
      // Create Gate.cx credentials if provided
      if (gateCredentials && gateCredentials.email && gateCredentials.password) {
        await tx.gateCredentials.create({
          data: {
            userId: user.id,
            email: gateCredentials.email,
            password: gateCredentials.password,
          },
        });
      }
      
      // Create Bybit credentials if provided
      if (bybitCredentials && bybitCredentials.apiKey && bybitCredentials.apiSecret) {
        await tx.bybitCredentials.create({
          data: {
            userId: user.id,
            apiKey: bybitCredentials.apiKey,
            apiSecret: bybitCredentials.apiSecret,
          },
        });
      }
      
      return user;
    });
    
    // Return the created user
    return {
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt,
      },
      error: null,
    };
  } catch (error) {
    logger.error('Admin create user error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}