import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route POST /auth/login
 * @description Authenticate user and generate JWT token
 * @body {Object} body - Login credentials
 * @body {string} body.username - User username
 * @body {string} body.password - User password
 * @returns {Object} Response - Login response with token
 */
export async function loginHandler({ body, jwt, set }: any) {
  try {
    const { username, password } = body;
    
    // Find user by username
    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });
    
    // Check if user exists and password matches
    if (!user || user.password !== password) { // In real app, use proper password hashing
      set.status = 401;
      return {
        success: false,
        error: 'Invalid username or password',
        data: null,
      };
    }
    
    // Generate JWT token
    const token = await jwt.sign({
      userId: user.id,
      username: user.username,
    });
    
    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Login error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}