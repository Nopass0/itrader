@echo off
echo.
echo Simple Gmail Setup
echo ==================
echo.
echo This script uses manual code entry for Gmail OAuth.
echo.
echo Instructions:
echo 1. The script will show you a URL
echo 2. Open it in your browser
echo 3. Sign in and authorize the app
echo 4. You'll be redirected to a URL like:
echo    http://localhost/?code=4/0AUJR...
echo 5. Copy ONLY the code part (after code=)
echo 6. Paste it when prompted
echo.
pause
echo.

REM Create a simple setup script
echo import { db } from "./src/db"; > setup-gmail-simple.ts
echo import { GmailClient } from "./src/gmail"; >> setup-gmail-simple.ts
echo import { OAuth2Manager } from "./src/gmail/utils/oauth2"; >> setup-gmail-simple.ts
echo import fs from "fs/promises"; >> setup-gmail-simple.ts
echo import path from "path"; >> setup-gmail-simple.ts
echo import readline from "readline"; >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo const rl = readline.createInterface({ >> setup-gmail-simple.ts
echo   input: process.stdin, >> setup-gmail-simple.ts
echo   output: process.stdout >> setup-gmail-simple.ts
echo }); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo function question(query: string): Promise^<string^> { >> setup-gmail-simple.ts
echo   return new Promise(resolve =^> rl.question(query, resolve)); >> setup-gmail-simple.ts
echo } >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo async function setup() { >> setup-gmail-simple.ts
echo   try { >> setup-gmail-simple.ts
echo     // Check credentials file >> setup-gmail-simple.ts
echo     const credentialsPath = path.join("data", "gmail-credentials.json"); >> setup-gmail-simple.ts
echo     try { >> setup-gmail-simple.ts
echo       await fs.access(credentialsPath); >> setup-gmail-simple.ts
echo     } catch { >> setup-gmail-simple.ts
echo       console.error("Error: Gmail credentials file not found!"); >> setup-gmail-simple.ts
echo       console.log(`Please place your credentials at: ${credentialsPath}`); >> setup-gmail-simple.ts
echo       process.exit(1); >> setup-gmail-simple.ts
echo     } >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     // Load credentials >> setup-gmail-simple.ts
echo     const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8')); >> setup-gmail-simple.ts
echo     const credentials = credentialsContent.installed ^|^| credentialsContent.web ^|^| credentialsContent; >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     // Create OAuth2Manager with manual mode >> setup-gmail-simple.ts
echo     const oauth2Manager = new OAuth2Manager(credentials); >> setup-gmail-simple.ts
echo     const authUrl = oauth2Manager.getAuthUrl(); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     console.log("\nOpen this URL in your browser:"); >> setup-gmail-simple.ts
echo     console.log(authUrl); >> setup-gmail-simple.ts
echo     console.log("\nAfter authorization, you'll be redirected to a URL like:"); >> setup-gmail-simple.ts
echo     console.log("http://localhost/?code=4/0AUJR-x6PQw...&scope=..."); >> setup-gmail-simple.ts
echo     console.log("\nCopy ONLY the code part (between code= and &scope)"); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     const code = await question("\nEnter the authorization code: "); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     console.log("\nExchanging code for tokens..."); >> setup-gmail-simple.ts
echo     const tokens = await oauth2Manager.getTokenFromCode(code.trim()); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     // Create client and get profile >> setup-gmail-simple.ts
echo     const client = new GmailClient(oauth2Manager); >> setup-gmail-simple.ts
echo     await client.setTokens(tokens); >> setup-gmail-simple.ts
echo     const profile = await client.getUserProfile(); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     // Save to database >> setup-gmail-simple.ts
echo     await db.upsertGmailAccount({ >> setup-gmail-simple.ts
echo       email: profile.emailAddress ^|^| "unknown", >> setup-gmail-simple.ts
echo       refreshToken: tokens.refresh_token ^|^| "", >> setup-gmail-simple.ts
echo     }); >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo     console.log(`\n✓ Gmail account ${profile.emailAddress} setup successfully!`); >> setup-gmail-simple.ts
echo   } catch (error) { >> setup-gmail-simple.ts
echo     console.error("\n✗ Setup failed:", error); >> setup-gmail-simple.ts
echo   } finally { >> setup-gmail-simple.ts
echo     rl.close(); >> setup-gmail-simple.ts
echo     await db.disconnect(); >> setup-gmail-simple.ts
echo   } >> setup-gmail-simple.ts
echo } >> setup-gmail-simple.ts
echo. >> setup-gmail-simple.ts
echo setup(); >> setup-gmail-simple.ts

REM Run the setup
bun run setup-gmail-simple.ts

REM Clean up
del setup-gmail-simple.ts

pause