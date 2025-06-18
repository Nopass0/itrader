#!/usr/bin/env bun
/**
 * Gmail OAuth Setup using OAuth 2.0 Playground method
 */

import { google } from "googleapis";
import { db } from "./src/db";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setup() {
  console.log("\n🔐 Gmail OAuth Setup (OAuth Playground Method)");
  console.log("=============================================\n");

  try {
    // Load credentials to get client ID and secret
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    console.log("📋 Альтернативный метод получения токенов через OAuth 2.0 Playground:\n");
    
    console.log("1. Откройте в браузере:");
    console.log("   https://developers.google.com/oauthplayground/\n");
    
    console.log("2. В правом верхнем углу нажмите на шестеренку ⚙️ (OAuth 2.0 configuration)");
    console.log("   - Поставьте галочку 'Use your own OAuth credentials'");
    console.log("   - OAuth Client ID: " + credentials.client_id);
    console.log("   - OAuth Client secret: " + credentials.client_secret);
    console.log("   - Нажмите 'Close'\n");
    
    console.log("3. В левой панели найдите 'Gmail API v1' и выберите:");
    console.log("   - https://www.googleapis.com/auth/gmail.readonly");
    console.log("   - https://www.googleapis.com/auth/gmail.modify\n");
    
    console.log("4. Нажмите 'Authorize APIs'");
    console.log("5. Авторизуйтесь в Google");
    console.log("6. Нажмите 'Exchange authorization code for tokens'");
    console.log("7. Скопируйте значение 'Refresh token'\n");
    
    const refreshToken = await question("📋 Вставьте Refresh Token: ");
    const email = await question("📧 Введите ваш Gmail email: ");
    rl.close();
    
    if (!refreshToken || !email) {
      console.error("\n❌ Refresh token и email обязательны!");
      process.exit(1);
    }
    
    console.log("\n🔄 Проверка токена...");
    
    // Create OAuth2 client and set refresh token
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      "http://localhost"
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken.trim()
    });
    
    try {
      // Test by getting access token
      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
      console.log("✅ Refresh token работает!");
      
      // Verify with Gmail API
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      
      console.log(`✅ Подтвержден email: ${profile.data.emailAddress}`);
      
      // Save to database
      await db.upsertGmailAccount({
        email: email.trim(),
        refreshToken: refreshToken.trim(),
      });
      
      console.log(`\n✅ Gmail аккаунт ${email} успешно настроен!`);
      
      // Save tokens backup
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify({
        refresh_token: refreshToken.trim(),
        ...newTokens,
        saved_at: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Токены сохранены в: ${tokensPath}`);
      
    } catch (error: any) {
      console.error("\n❌ Ошибка при проверке токена!");
      console.error(`Сообщение: ${error.message}`);
      console.log("\nВозможные причины:");
      console.log("1. Неверный refresh token");
      console.log("2. Неправильные client_id или client_secret");
      console.log("3. Токен для другого приложения");
    }
    
  } catch (error) {
    console.error("\n❌ Ошибка:", error);
  }
  
  await db.disconnect();
}

setup();