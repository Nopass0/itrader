@echo off
echo.
echo Gmail OAuth Debug Tool
echo ======================
echo.
echo This tool helps diagnose Gmail OAuth issues.
echo.

REM Create debug script
echo import fs from "fs/promises"; > debug-oauth.ts
echo import path from "path"; >> debug-oauth.ts
echo. >> debug-oauth.ts
echo async function debug() { >> debug-oauth.ts
echo   try { >> debug-oauth.ts
echo     // Check credentials file >> debug-oauth.ts
echo     const credentialsPath = path.join("data", "gmail-credentials.json"); >> debug-oauth.ts
echo     console.log("Checking credentials file..."); >> debug-oauth.ts
echo     try { >> debug-oauth.ts
echo       const content = await fs.readFile(credentialsPath, 'utf-8'); >> debug-oauth.ts
echo       const creds = JSON.parse(content); >> debug-oauth.ts
echo       const oauth = creds.installed ^|^| creds.web ^|^| creds; >> debug-oauth.ts
echo. >> debug-oauth.ts
echo       console.log("\n✓ Credentials file found"); >> debug-oauth.ts
echo       console.log("\nOAuth Configuration:"); >> debug-oauth.ts
echo       console.log("- Client ID:", oauth.client_id ? "Found" : "MISSING"); >> debug-oauth.ts
echo       console.log("- Client Secret:", oauth.client_secret ? "Found" : "MISSING"); >> debug-oauth.ts
echo       console.log("- Auth URI:", oauth.auth_uri ^|^| "MISSING"); >> debug-oauth.ts
echo       console.log("- Token URI:", oauth.token_uri ^|^| "MISSING"); >> debug-oauth.ts
echo       console.log("- Redirect URIs:", oauth.redirect_uris ? oauth.redirect_uris.join(", ") : "MISSING"); >> debug-oauth.ts
echo. >> debug-oauth.ts
echo       if (oauth.redirect_uris && oauth.redirect_uris.length ^> 0) { >> debug-oauth.ts
echo         console.log("\n⚠️  Make sure your Google OAuth app uses one of these redirect URIs"); >> debug-oauth.ts
echo       } else { >> debug-oauth.ts
echo         console.log("\n⚠️  No redirect URIs found - using default http://localhost/"); >> debug-oauth.ts
echo       } >> debug-oauth.ts
echo. >> debug-oauth.ts
echo       console.log("\n📋 Next Steps:"); >> debug-oauth.ts
echo       console.log("1. Go to Google Cloud Console"); >> debug-oauth.ts
echo       console.log("2. Check your OAuth 2.0 Client ID settings"); >> debug-oauth.ts
echo       console.log("3. Make sure redirect URI matches what's shown above"); >> debug-oauth.ts
echo       console.log("4. Get a fresh authorization code"); >> debug-oauth.ts
echo       console.log("5. Use the code immediately (within 1-2 minutes)"); >> debug-oauth.ts
echo. >> debug-oauth.ts
echo     } catch (error) { >> debug-oauth.ts
echo       console.error("✗ Error reading credentials:", error); >> debug-oauth.ts
echo     } >> debug-oauth.ts
echo   } catch (error) { >> debug-oauth.ts
echo     console.error("Debug error:", error); >> debug-oauth.ts
echo   } >> debug-oauth.ts
echo } >> debug-oauth.ts
echo. >> debug-oauth.ts
echo debug(); >> debug-oauth.ts

REM Run debug
bun run debug-oauth.ts

REM Clean up
del debug-oauth.ts

echo.
pause