/**
 * Gmail модуль для работы с Gmail API
 */

export { GmailManager } from "./manager";
export { GmailClient } from "./client";
export { OAuth2Manager } from "./utils/oauth2";
export { EmailParser } from "./utils/emailParser";

export {
  saveTokensToFile,
  loadTokensFromFile,
  hasRequiredScopes,
} from "./utils/oauth2";

export * from "./types/models";