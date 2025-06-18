@echo off
echo.
echo Gmail Setup (Fixed Version)
echo ===========================
echo.
echo This setup handles redirect URI issues properly.
echo.

REM Create setup script with better handling
echo import { db } from "./src/db"; > setup-gmail-fixed.ts
echo import { google } from "googleapis"; >> setup-gmail-fixed.ts
echo import fs from "fs/promises"; >> setup-gmail-fixed.ts
echo import path from "path"; >> setup-gmail-fixed.ts
echo import readline from "readline"; >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo const rl = readline.createInterface({ >> setup-gmail-fixed.ts
echo   input: process.stdin, >> setup-gmail-fixed.ts
echo   output: process.stdout >> setup-gmail-fixed.ts
echo }); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo function question(query: string): Promise^<string^> { >> setup-gmail-fixed.ts
echo   return new Promise(resolve =^> rl.question(query, resolve)); >> setup-gmail-fixed.ts
echo } >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo async function setup() { >> setup-gmail-fixed.ts
echo   try { >> setup-gmail-fixed.ts
echo     // Load credentials >> setup-gmail-fixed.ts
echo     const credentialsPath = path.join("data", "gmail-credentials.json"); >> setup-gmail-fixed.ts
echo     const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8')); >> setup-gmail-fixed.ts
echo     const credentials = credentialsContent.installed ^|^| credentialsContent.web ^|^| credentialsContent; >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Use the first redirect URI from credentials or default >> setup-gmail-fixed.ts
echo     const redirectUri = (credentials.redirect_uris && credentials.redirect_uris[0]) ^|^| "http://localhost/"; >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     console.log("\nUsing redirect URI:", redirectUri); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Create OAuth2 client >> setup-gmail-fixed.ts
echo     const oauth2Client = new google.auth.OAuth2( >> setup-gmail-fixed.ts
echo       credentials.client_id, >> setup-gmail-fixed.ts
echo       credentials.client_secret, >> setup-gmail-fixed.ts
echo       redirectUri >> setup-gmail-fixed.ts
echo     ); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Generate auth URL >> setup-gmail-fixed.ts
echo     const authUrl = oauth2Client.generateAuthUrl({ >> setup-gmail-fixed.ts
echo       access_type: 'offline', >> setup-gmail-fixed.ts
echo       scope: [ >> setup-gmail-fixed.ts
echo         'https://www.googleapis.com/auth/gmail.readonly', >> setup-gmail-fixed.ts
echo         'https://www.googleapis.com/auth/gmail.modify' >> setup-gmail-fixed.ts
echo       ] >> setup-gmail-fixed.ts
echo     }); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     console.log("\n🔗 Open this URL in a NEW incognito/private browser window:"); >> setup-gmail-fixed.ts
echo     console.log(authUrl); >> setup-gmail-fixed.ts
echo     console.log("\n⚠️  IMPORTANT: Use a fresh browser session to avoid cached auth"); >> setup-gmail-fixed.ts
echo     console.log("\nAfter authorization, copy the code from the URL"); >> setup-gmail-fixed.ts
echo     console.log("Example: http://localhost/?code=4/0AUJR-x6PQ...&scope=..."); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     const code = await question("\nEnter the authorization code: "); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     console.log("\nExchanging code for tokens..."); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Get tokens >> setup-gmail-fixed.ts
echo     const { tokens } = await oauth2Client.getToken(code.trim()); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     if (!tokens.refresh_token) { >> setup-gmail-fixed.ts
echo       console.error("\n⚠️  Warning: No refresh token received"); >> setup-gmail-fixed.ts
echo       console.log("This might happen if the app was already authorized"); >> setup-gmail-fixed.ts
echo       console.log("Try revoking access at: https://myaccount.google.com/permissions"); >> setup-gmail-fixed.ts
echo     } >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Set credentials and get user info >> setup-gmail-fixed.ts
echo     oauth2Client.setCredentials(tokens); >> setup-gmail-fixed.ts
echo     const gmail = google.gmail({ version: 'v1', auth: oauth2Client }); >> setup-gmail-fixed.ts
echo     const profile = await gmail.users.getProfile({ userId: 'me' }); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     // Save to database >> setup-gmail-fixed.ts
echo     await db.upsertGmailAccount({ >> setup-gmail-fixed.ts
echo       email: profile.data.emailAddress ^|^| "unknown", >> setup-gmail-fixed.ts
echo       refreshToken: tokens.refresh_token ^|^| "", >> setup-gmail-fixed.ts
echo     }); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo     console.log(`\n✅ SUCCESS! Gmail account ${profile.data.emailAddress} is now connected`); >> setup-gmail-fixed.ts
echo     console.log("\nYou can now use Itrader with Gmail integration"); >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo   } catch (error: any) { >> setup-gmail-fixed.ts
echo     console.error("\n❌ Setup failed:", error.message); >> setup-gmail-fixed.ts
echo     if (error.message && error.message.includes('invalid_grant')) { >> setup-gmail-fixed.ts
echo       console.log("\n💡 Tips to fix invalid_grant error:"); >> setup-gmail-fixed.ts
echo       console.log("1. Use a NEW incognito/private browser window"); >> setup-gmail-fixed.ts
echo       console.log("2. Make sure to use a FRESH authorization code"); >> setup-gmail-fixed.ts
echo       console.log("3. Complete the process within 1-2 minutes"); >> setup-gmail-fixed.ts
echo       console.log("4. Don't use a code that was already used"); >> setup-gmail-fixed.ts
echo       console.log("5. Check that redirect URIs match in Google Console"); >> setup-gmail-fixed.ts
echo     } >> setup-gmail-fixed.ts
echo   } finally { >> setup-gmail-fixed.ts
echo     rl.close(); >> setup-gmail-fixed.ts
echo     await db.disconnect(); >> setup-gmail-fixed.ts
echo   } >> setup-gmail-fixed.ts
echo } >> setup-gmail-fixed.ts
echo. >> setup-gmail-fixed.ts
echo setup(); >> setup-gmail-fixed.ts

REM Run setup
bun run setup-gmail-fixed.ts

REM Clean up
del setup-gmail-fixed.ts

pause