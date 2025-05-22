import { PrismaClient } from '@prisma/client';
import { realGateService } from './realGateService.js';

const prisma = new PrismaClient();

export class SessionManager {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkInterval = 5 * 60 * 1000; // Check every 5 minutes

  start(): void {
    if (this.intervalId) {
      console.log('[SessionManager] Already running');
      return;
    }

    console.log('[SessionManager] Starting session refresh manager');
    
    // Run initial check immediately
    this.checkAndRefreshSessions();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndRefreshSessions();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SessionManager] Stopped session refresh manager');
    }
  }

  private async checkAndRefreshSessions(): Promise<void> {
    try {
      console.log('[SessionManager] Checking for sessions that need refresh...');

      // Find accounts that need refresh (nextUpdateAt is past or within 1 minute)
      const accountsToRefresh = await prisma.gateCredentials.findMany({
        where: {
          OR: [
            {
              nextUpdateAt: {
                lte: new Date(Date.now() + 60 * 1000) // Within next minute
              }
            },
            {
              AND: [
                { status: 'active' },
                { nextUpdateAt: null }
              ]
            }
          ]
        }
      });

      if (accountsToRefresh.length === 0) {
        console.log('[SessionManager] No sessions need refresh');
        return;
      }

      console.log(`[SessionManager] Found ${accountsToRefresh.length} sessions to refresh`);

      // Refresh each session
      for (const account of accountsToRefresh) {
        try {
          console.log(`[SessionManager] Refreshing session for account ${account.id} (${account.email})`);
          await realGateService.refreshSession(account.id);
        } catch (error: any) {
          console.error(`[SessionManager] Error refreshing session for account ${account.id}:`, error.message);
        }
      }

      console.log('[SessionManager] Session refresh cycle completed');
    } catch (error: any) {
      console.error('[SessionManager] Error in session check cycle:', error.message);
    }
  }

  async refreshAccountNow(accountId: number): Promise<boolean> {
    try {
      console.log(`[SessionManager] Manual refresh requested for account ${accountId}`);
      return await realGateService.refreshSession(accountId);
    } catch (error: any) {
      console.error(`[SessionManager] Error in manual refresh for account ${accountId}:`, error.message);
      return false;
    }
  }

  async getSessionStatus(): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    errorAccounts: number;
    nextRefreshIn: number | null; // minutes
  }> {
    try {
      const accounts = await prisma.gateCredentials.findMany({
        select: {
          id: true,
          status: true,
          nextUpdateAt: true
        }
      });

      const totalAccounts = accounts.length;
      const activeAccounts = accounts.filter(a => a.status === 'active').length;
      const errorAccounts = accounts.filter(a => a.status === 'error').length;

      // Find the earliest nextUpdateAt
      const nextRefreshTimes = accounts
        .filter(a => a.nextUpdateAt)
        .map(a => a.nextUpdateAt!.getTime())
        .sort();

      const nextRefreshIn = nextRefreshTimes.length > 0
        ? Math.max(0, Math.floor((nextRefreshTimes[0] - Date.now()) / (60 * 1000)))
        : null;

      return {
        totalAccounts,
        activeAccounts,
        errorAccounts,
        nextRefreshIn
      };
    } catch (error: any) {
      console.error('[SessionManager] Error getting session status:', error.message);
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        errorAccounts: 0,
        nextRefreshIn: null
      };
    }
  }
}

export const sessionManager = new SessionManager();