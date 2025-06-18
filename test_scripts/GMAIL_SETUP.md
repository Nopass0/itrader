# Gmail Setup Guide for Itrader

## Prerequisites

Before setting up Gmail integration, you need to:

1. Create a Google Cloud Project
2. Enable Gmail API
3. Create OAuth2 credentials
4. Download credentials JSON file

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "Itrader")
4. Click "Create"

### 2. Enable Gmail API

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

### 3. Create OAuth2 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields (app name, email)
   - Add scopes: `gmail.readonly` and `gmail.modify`
   - Add test users (your email)
4. For Application type, select "Desktop app"
5. Name it (e.g., "Itrader Desktop")
6. For redirect URIs, you can use:
   - `http://localhost/` (default)
   - `http://localhost:3000/oauth2callback`
   - Or leave it as Google's default
7. Click "Create"

### 4. Download Credentials

1. After creating OAuth client, click download button (⬇️)
2. Save the JSON file
3. Rename it to `gmail-credentials.json`
4. Place it in: `C:\Projects\itrader_project\data\gmail-credentials.json`

### 5. Configure in Itrader

**Option A: Automatic Setup (if redirect works)**
1. Run Itrader CLI:
   ```
   .\start.bat
   ```
2. Select option `1` (CLI)
3. Choose "Manage Gmail account"
4. Select "Setup account"
5. Browser opens automatically
6. Sign in and grant permissions
7. Setup completes automatically

**Option B: Manual Setup (recommended)**
1. Run the simple setup:
   ```
   .\setup-gmail-simple.bat
   ```
2. Open the URL shown in your browser
3. Sign in and grant permissions
4. After redirect, copy the code from URL:
   - URL will look like: `http://localhost/?code=4/0AUJR-x6PQw...&scope=...`
   - Copy only the code part (between `code=` and `&scope`)
5. Paste the code when prompted

## File Structure

After setup, you should have:
```
data/
├── gmail-credentials.json    # OAuth2 credentials (from Google)
├── database.db              # SQLite database with refresh token
└── cookies/                 # Gate.io cookies
```

## Troubleshooting

### "Gmail credentials file not found"
- Make sure `gmail-credentials.json` is in `data/` folder
- Check file name is exactly `gmail-credentials.json`

### "Access blocked: Authorization Error"
- Make sure you added your email as test user in OAuth consent screen
- Or publish the app (requires verification)

### "Invalid authorization code" or "invalid_grant"
- This usually means the OAuth setup is incorrect
- Make sure you're using "Desktop app" type credentials
- Try using the manual setup script: `.\setup-gmail-simple.bat`
- Make sure to copy ONLY the code part, not the entire URL
- Codes expire quickly - complete the process within a few minutes
- If still failing, create new credentials

### Port 80 Access Denied
- The automatic setup tries to use port 80 which may require admin rights
- Use the manual setup instead: `.\setup-gmail-simple.bat`
- Or run the command prompt as Administrator

### Token Expired
- Refresh tokens should auto-renew
- If not working, run setup again

## Security Notes

1. **Never share** `gmail-credentials.json` - it contains your app secrets
2. **Keep secure** the database - it contains refresh tokens
3. **Use test mode** during development
4. **Limit scopes** to only what's needed (gmail.readonly, gmail.modify)

## Required Scopes

The app requests these Gmail scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.modify` - Mark emails as read

## Testing

After setup, test with:
1. CLI → "Manage Gmail account" → "Test account"
2. Should show count of Tinkoff emails

## Production Considerations

For production use:
1. Verify OAuth consent screen
2. Use service account instead of OAuth2 (if possible)
3. Implement proper token storage encryption
4. Add error handling for quota limits
5. Use a fixed port for the OAuth callback server
6. Consider implementing a timeout for the authorization flow

## Technical Details

### OAuth Flow
1. The app starts a local server on port 3000
2. Opens browser with Google OAuth URL
3. After authorization, Google redirects to `http://localhost:3000/oauth2callback`
4. Local server captures the authorization code
5. Code is exchanged for refresh token
6. Refresh token is stored in database