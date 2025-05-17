import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route POST /auth/register
 * @description Register a new user with admin token
 * @body {Object} body - Registration data
 * @body {string} body.username - New user username
 * @body {string} body.password - New user password
 * @body {string} body.adminToken - Admin token for authorization
 * @returns {Object} Response - Registration response
 */
export async function registerHandler({ body, set }: any) {
  try {
    const { username, password, adminToken } = body;
    
    // Find admin by token
    const admin = await prisma.admin.findUnique({
      where: {
        token: adminToken,
      },
    });
    
    // Check if admin token is valid
    if (!admin) {
      set.status = 401;
      return {
        success: false,
        error: 'Invalid admin token',
        data: null,
      };
    }
    
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
    
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        username,
        password, // In real app, use proper password hashing
        adminId: admin.id,
      },
    });
    
    return {
      success: true,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Registration error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}