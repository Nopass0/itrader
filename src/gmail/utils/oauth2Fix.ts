/**
 * OAuth2 fix for handling various redirect URI configurations
 */

import { OAuth2Manager } from "./oauth2";
import type { OAuth2Credentials } from "../types/models";

/**
 * Creates an OAuth2Manager with proper redirect URI handling
 * @param credentials - OAuth2 credentials from Google
 * @param scopes - Required scopes
 * @returns Configured OAuth2Manager
 */
export function createOAuth2Manager(
  credentials: OAuth2Credentials,
  scopes?: string[]
): OAuth2Manager {
  // Check if credentials have redirect URIs configured
  const hasRedirectUris = credentials.redirect_uris && credentials.redirect_uris.length > 0;
  
  // If no redirect URIs, we need to use the manual flow
  if (!hasRedirectUris) {
    console.log("Note: No redirect URIs configured. Using manual code entry.");
    // Add a default redirect URI
    credentials.redirect_uris = ["http://localhost/"];
  }
  
  // Create OAuth2Manager with proper configuration
  return new OAuth2Manager(credentials, scopes, false);
}

/**
 * Extracts authorization code from redirect URL
 * @param url - The full redirect URL (possibly URL-encoded)
 * @returns The authorization code or null
 */
export function extractCodeFromUrl(url: string): string | null {
  try {
    // First try to decode the URL if it's encoded
    let decodedUrl = url;
    if (url.includes("%")) {
      try {
        decodedUrl = decodeURIComponent(url);
      } catch {
        // If decoding fails, use original
      }
    }
    
    // Try to parse as URL
    const urlObj = new URL(decodedUrl);
    let code = urlObj.searchParams.get("code");
    
    // If code is still encoded, decode it
    if (code && code.includes("%")) {
      try {
        code = decodeURIComponent(code);
      } catch {
        // Use as is if decoding fails
      }
    }
    
    return code;
  } catch {
    // Try to extract code using regex as fallback
    let decodedUrl = url;
    if (url.includes("%")) {
      try {
        decodedUrl = decodeURIComponent(url);
      } catch {
        // Use original if decoding fails
      }
    }
    
    const match = decodedUrl.match(/[?&]code=([^&]+)/);
    if (match) {
      let code = match[1];
      // Decode if needed
      if (code.includes("%")) {
        try {
          code = decodeURIComponent(code);
        } catch {
          // Use as is
        }
      }
      return code;
    }
    return null;
  }
}

/**
 * Validates Gmail credentials structure
 * @param credentials - Credentials object to validate
 * @returns true if valid
 */
export function validateCredentials(credentials: any): boolean {
  if (!credentials) return false;
  
  // Check for OAuth2 credentials (can be under 'installed' or 'web')
  const oauth2Creds = credentials.installed || credentials.web || credentials;
  
  return !!(oauth2Creds.client_id && oauth2Creds.client_secret);
}