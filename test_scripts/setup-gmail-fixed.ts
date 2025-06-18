#!/usr/bin/env bun
/**
 * Gmail OAuth Setup - Fixed redirect_uri matching
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
  console.log("\n🔐 Gmail OAuth Setup (Fixed Version)");
  console.log("====================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // ВАЖНО: Используем один и тот же redirect URI везде
    const REDIRECT_URI = "http://localhost";
    
    console.log("📋 Configuration:");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Redirect URI: ${REDIRECT_URI}`);
    console.log(`   Time: ${new Date().toISOString()}\n`);
    
    // Create OAuth2 client with EXACT redirect URI
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      REDIRECT_URI  // Точно такой же URI будет использован при обмене кода
    );
    
    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      prompt: "consent", // Форсируем показ consent screen для получения refresh_token
    });
    
    console.log("📋 ИНСТРУКЦИИ:");
    console.log("=============\n");
    console.log("1. Откройте НОВОЕ окно в режиме инкогнито");
    console.log("2. Перейдите по этой ссылке:");
    console.log(`\n${authUrl}\n`);
    console.log("3. Авторизуйтесь в Google");
    console.log("4. Вас перенаправит на страницу с ошибкой 'This site can't be reached'");
    console.log("5. Скопируйте ПОЛНЫЙ URL из адресной строки браузера");
    console.log("   Пример: http://localhost/?code=4/0AUJR-x7...&scope=...\n");
    
    const fullUrl = await question("📋 Вставьте ПОЛНЫЙ URL здесь: ");
    rl.close();
    
    // Extract code from URL
    let code: string;
    try {
      const url = new URL(fullUrl.trim());
      code = url.searchParams.get("code") || "";
      
      if (!code) {
        throw new Error("Код не найден в URL");
      }
      
      // Проверяем что redirect_uri совпадает
      const receivedRedirectBase = `${url.protocol}//${url.host}`;
      console.log(`\n🔍 Проверка redirect_uri:`);
      console.log(`   Ожидается: ${REDIRECT_URI}`);
      console.log(`   Получено: ${receivedRedirectBase}`);
      
      if (receivedRedirectBase !== REDIRECT_URI) {
        console.error("\n❌ ОШИБКА: redirect_uri не совпадает!");
        console.log("Это может быть причиной ошибки invalid_grant");
        process.exit(1);
      }
      
      console.log(`✅ redirect_uri совпадает`);
      console.log(`✅ Код извлечен (${code.length} символов)`);
      
    } catch (error) {
      console.error("\n❌ Ошибка парсинга URL!");
      console.log("Убедитесь что скопировали ВЕСЬ URL включая http://");
      process.exit(1);
    }
    
    // Exchange code immediately
    console.log("\n🔄 Обмен кода на токены (немедленно)...");
    console.log(`   Время: ${new Date().toISOString()}`);
    
    try {
      // getToken использует тот же redirect_uri что был передан в конструктор
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log("\n✅ УСПЕХ! Токены получены:");
      console.log(`   Access Token: ${tokens.access_token?.substring(0, 30)}...`);
      console.log(`   Refresh Token: ${tokens.refresh_token ? "Получен" : "НЕ получен"}`);
      console.log(`   Expires: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : "Unknown"}`);
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  Refresh token не получен!");
        console.log("   Возможные причины:");
        console.log("   1. Вы уже авторизовывали это приложение ранее");
        console.log("   2. Не был показан consent screen");
        console.log("\n   Решение:");
        console.log("   1. Перейдите на https://myaccount.google.com/permissions");
        console.log("   2. Найдите ваше приложение и удалите доступ");
        console.log("   3. Запустите setup снова");
      }
      
      // Get user email
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      // Save to database
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token || "",
      });
      
      console.log(`\n✅ Gmail аккаунт ${email} успешно настроен!`);
      
      // Save tokens backup
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify({
        ...tokens,
        saved_at: new Date().toISOString(),
        redirect_uri_used: REDIRECT_URI
      }, null, 2));
      console.log(`💾 Токены сохранены в: ${tokensPath}`);
      
    } catch (error: any) {
      console.error("\n❌ Ошибка обмена кода!");
      console.error(`Сообщение: ${error.message}`);
      
      if (error.response?.data) {
        console.error("\nДетали от Google:");
        console.error(JSON.stringify(error.response.data, null, 2));
      }
      
      console.log("\n💡 Чек-лист для решения проблемы:");
      console.log("✓ Использовали НОВЫЙ код (открыли auth URL в новом инкогнито окне)");
      console.log("✓ Обменяли код сразу (в течение 1-2 минут)");
      console.log("✓ Скопировали ВЕСЬ URL из браузера");
      console.log("✓ redirect_uri точно совпадает: " + REDIRECT_URI);
      console.log("✓ В Google Console добавлен этот redirect URI");
      console.log("✓ Системное время синхронизировано");
      
      // Check system time
      console.log(`\n🕐 Системное время: ${new Date().toISOString()}`);
      console.log("   Если время неверное, синхронизируйте:");
      console.log("   sudo ntpdate -s time.nist.gov");
    }
    
  } catch (error) {
    console.error("\n❌ Ошибка setup:", error);
  }
  
  await db.disconnect();
}

setup();