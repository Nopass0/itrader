import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config';
import { GateService } from './gateService';
import { BybitService } from './bybitService';

const prisma = new PrismaClient();

// Setup and refresh sessions for all users
export async function setupSessions(): Promise<void> {
  logger.info('Setting up platform sessions...');
  
  try {
    // Refresh sessions immediately on startup
    await refreshAllSessions();
    
    // Setup interval to refresh sessions
    const intervalMinutes = config.sessionRefreshInterval;
    logger.info(`Scheduling session refresh every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        await refreshAllSessions();
      } catch (error) {
        logger.error('Error refreshing sessions:', error);
      }
    }, intervalMinutes * 60 * 1000);
    
  } catch (error) {
    logger.error('Error setting up sessions:', error);
    throw error;
  }
}

// Refresh all sessions for all users
async function refreshAllSessions(): Promise<void> {
  logger.info('Refreshing all sessions...');
  
  try {
    // Get all users with Gate.cx credentials
    const usersWithGate = await prisma.user.findMany({
      where: {
        gateCredentials: {
          isNot: null,
        },
      },
      include: {
        gateCredentials: true,
      },
    });
    
    // Get all users with Bybit credentials
    const usersWithBybit = await prisma.user.findMany({
      where: {
        bybitCredentials: {
          isNot: null,
        },
      },
      include: {
        bybitCredentials: true,
      },
    });
    
    logger.info(`Found ${usersWithGate.length} users with Gate.cx credentials`);
    logger.info(`Found ${usersWithBybit.length} users with Bybit credentials`);
    
    // Refresh Gate.cx sessions
    for (const user of usersWithGate) {
      if (!user.gateCredentials) continue;
      
      try {
        logger.info(`Refreshing Gate.cx session for user ${user.id} (${user.username})`);
        
        // Use Gate.cx service to authenticate and save session
        const gateService = new GateService();
        await gateService.authenticate(
          user.gateCredentials.email,
          user.gateCredentials.password,
          user.id
        );
        
        logger.info(`Gate.cx session refreshed for user ${user.id}`);
      } catch (error) {
        logger.error(`Failed to refresh Gate.cx session for user ${user.id}:`, error);
      }
    }
    
    // Refresh Bybit sessions
    for (const user of usersWithBybit) {
      if (!user.bybitCredentials) continue;
      
      try {
        logger.info(`Refreshing Bybit session for user ${user.id} (${user.username})`);
        
        // Use Bybit service to verify API key and save session
        const bybitService = new BybitService();
        await bybitService.verifyApiKey(
          user.bybitCredentials.apiKey,
          user.bybitCredentials.apiSecret,
          user.id
        );
        
        logger.info(`Bybit session refreshed for user ${user.id}`);
      } catch (error) {
        logger.error(`Failed to refresh Bybit session for user ${user.id}:`, error);
      }
    }
    
    logger.info('All sessions have been refreshed');
  } catch (error) {
    logger.error('Error in refreshAllSessions:', error);
    throw error;
  }
}