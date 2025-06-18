@echo off
echo.
echo Testing Gmail Setup
echo ===================
echo.
echo This will test your Gmail integration.
echo Make sure you have completed the setup first.
echo.

REM Check if credentials file exists
if not exist "data\gmail-credentials.json" (
    echo ERROR: Gmail credentials file not found!
    echo.
    echo Please follow the setup guide in GMAIL_SETUP.md
    echo.
    pause
    exit /b 1
)

echo Starting test...
echo.

REM Create a simple test script
echo import { db } from "./src/db"; > test-gmail.ts
echo import { GmailClient } from "./src/gmail"; >> test-gmail.ts
echo import { OAuth2Manager } from "./src/gmail/utils/oauth2"; >> test-gmail.ts
echo import fs from "fs/promises"; >> test-gmail.ts
echo import path from "path"; >> test-gmail.ts
echo. >> test-gmail.ts
echo async function test() { >> test-gmail.ts
echo   try { >> test-gmail.ts
echo     const account = await db.getActiveGmailAccount(); >> test-gmail.ts
echo     if (!account) { >> test-gmail.ts
echo       console.log("No Gmail account configured. Please run setup first."); >> test-gmail.ts
echo       return; >> test-gmail.ts
echo     } >> test-gmail.ts
echo. >> test-gmail.ts
echo     const credentialsPath = path.join("data", "gmail-credentials.json"); >> test-gmail.ts
echo     const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8')); >> test-gmail.ts
echo     const credentials = credentialsContent.installed ^|^| credentialsContent.web ^|^| credentialsContent; >> test-gmail.ts
echo. >> test-gmail.ts
echo     const oauth2Manager = new OAuth2Manager(credentials); >> test-gmail.ts
echo     const client = new GmailClient(oauth2Manager); >> test-gmail.ts
echo     await client.setTokens({ refresh_token: account.refreshToken }); >> test-gmail.ts
echo. >> test-gmail.ts
echo     console.log(`Testing Gmail account: ${account.email}`); >> test-gmail.ts
echo     console.log("Fetching recent emails from Tinkoff..."); >> test-gmail.ts
echo. >> test-gmail.ts
echo     const emails = await client.getEmailsFromSender("noreply@tinkoff.ru", 5); >> test-gmail.ts
echo     console.log(`\nFound ${emails.length} emails from Tinkoff`); >> test-gmail.ts
echo. >> test-gmail.ts
echo     if (emails.length ^> 0) { >> test-gmail.ts
echo       console.log("\nRecent emails:"); >> test-gmail.ts
echo       emails.forEach((email, i) =^> { >> test-gmail.ts
echo         console.log(`${i + 1}. ${email.subject} - ${new Date(parseInt(email.internalDate)).toLocaleString()}`); >> test-gmail.ts
echo       }); >> test-gmail.ts
echo     } >> test-gmail.ts
echo. >> test-gmail.ts
echo     console.log("\n✓ Gmail integration is working!"); >> test-gmail.ts
echo   } catch (error) { >> test-gmail.ts
echo     console.error("\n✗ Gmail test failed:", error); >> test-gmail.ts
echo   } finally { >> test-gmail.ts
echo     await db.disconnect(); >> test-gmail.ts
echo   } >> test-gmail.ts
echo } >> test-gmail.ts
echo. >> test-gmail.ts
echo test(); >> test-gmail.ts

REM Run the test
bun run test-gmail.ts

REM Clean up
del test-gmail.ts

echo.
pause