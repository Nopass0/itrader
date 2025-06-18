#!/usr/bin/env bun

/**
 * Check Gmail token permissions
 */

import { PrismaClient } from "./generated/prisma";
import { createLogger } from "./src/logger";

const logger = createLogger("CheckGmailToken");
const prisma = new PrismaClient();

async function checkGmailToken() {
  try {
    const gmailAccount = await prisma.gmailAccount.findFirst({
      where: { isActive: true }
    });
    
    if (!gmailAccount) {
      logger.error("No active Gmail account found");
      return;
    }
    
    logger.info("Gmail account found", {
      email: gmailAccount.email,
      hasRefreshToken: !!gmailAccount.refreshToken,
      refreshTokenLength: gmailAccount.refreshToken?.length || 0
    });
    
    // Check if refresh token looks valid
    if (!gmailAccount.refreshToken || gmailAccount.refreshToken.length < 20) {
      logger.error("Invalid refresh token", {
        tokenLength: gmailAccount.refreshToken?.length || 0
      });
      logger.info("Please run the Gmail setup script to get a valid token");
      return;
    }
    
    // Try to decode the token (base64)
    try {
      const tokenParts = gmailAccount.refreshToken.split('.');
      logger.info("Token structure", {
        parts: tokenParts.length,
        isJWT: tokenParts.length === 3,
        startsWithCorrectPrefix: gmailAccount.refreshToken.startsWith('1//') // Google refresh tokens often start with 1//
      });
    } catch (e) {
      // Not a JWT, which is fine for refresh tokens
    }
    
    logger.info("✅ Token appears to be present. If authentication fails, you may need to:");
    logger.info("1. Re-run the Gmail setup to get a new token");
    logger.info("2. Check that the token has the right scopes (gmail.readonly, gmail.send)");
    logger.info("3. Ensure the Gmail API is enabled in Google Cloud Console");
    
  } catch (error) {
    logger.error("Error checking token", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGmailToken();