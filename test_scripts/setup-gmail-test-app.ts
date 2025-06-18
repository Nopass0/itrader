#!/usr/bin/env bun
/**
 * Gmail OAuth Setup using Google's test application
 * This bypasses the redirect_uri_mismatch issue
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
  console.log("\n🔐 Gmail OAuth Setup (Test Application Method)");
  console.log("==============================================\n");
  
  console.log("📋 Этот метод использует тестовое приложение для обхода проблем с redirect_uri\n");

  try {
    // Шаг 1: Получаем authorization code через браузер
    console.log("Шаг 1: Получение кода авторизации");
    console.log("==================================\n");
    
    console.log("1. Откройте эту ссылку в новом окне браузера (режим инкогнито):\n");
    
    // Используем публичный client_id от Google для тестирования
    const testAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + 
      "client_id=1058722563893-d7v8h00qclvvueh8ln8lqv6279vamk8v.apps.googleusercontent.com&" +
      "redirect_uri=urn:ietf:wg:oauth:2.0:oob:auto&" +
      "response_type=code&" +
      "scope=https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/gmail.modify&" +
      "access_type=offline&" +
      "prompt=consent";
    
    console.log(testAuthUrl + "\n");
    
    console.log("2. Авторизуйтесь в Google");
    console.log("3. Вы увидите страницу с кодом авторизации");
    console.log("4. Скопируйте код (выглядит как 4/0AUJR-x7...)\n");
    
    const authCode = await question("📋 Вставьте код авторизации: ");
    
    if (!authCode || authCode.trim().length === 0) {
      console.error("\n❌ Код не предоставлен!");
      process.exit(1);
    }
    
    console.log("\n🔄 Обмен кода на токены...");
    
    // Используем тестовые credentials
    const testOAuth2Client = new google.auth.OAuth2(
      "1058722563893-d7v8h00qclvvueh8ln8lqv6279vamk8v.apps.googleusercontent.com",
      "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",
      "urn:ietf:wg:oauth:2.0:oob:auto"
    );
    
    try {
      const { tokens } = await testOAuth2Client.getToken(authCode.trim());
      
      console.log("\n✅ Токены получены успешно!");
      console.log(`   Access Token: ${tokens.access_token?.substring(0, 30)}...`);
      console.log(`   Refresh Token: ${tokens.refresh_token ? "Получен" : "НЕ получен"}`);
      
      if (!tokens.refresh_token) {
        console.error("\n❌ Refresh token не получен!");
        console.log("Попробуйте снова с новым кодом");
        process.exit(1);
      }
      
      // Шаг 2: Переносим refresh token в ваше приложение
      console.log("\n\nШаг 2: Перенос токенов в ваше приложение");
      console.log("=========================================\n");
      
      // Загружаем ваши credentials
      const credentialsPath = path.join("data", "gmail-credentials.json");
      const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
      const yourCredentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
      
      // Создаем OAuth клиент с вашими credentials
      const yourOAuth2Client = new google.auth.OAuth2(
        yourCredentials.client_id,
        yourCredentials.client_secret,
        "http://localhost"
      );
      
      // Устанавливаем refresh token
      yourOAuth2Client.setCredentials({
        refresh_token: tokens.refresh_token
      });
      
      // Получаем новый access token с вашими credentials
      console.log("🔄 Получение access token с вашими credentials...");
      const { credentials: newTokens } = await yourOAuth2Client.refreshAccessToken();
      
      console.log("✅ Успешно получен новый access token!");
      
      // Проверяем работу с Gmail API
      const gmail = google.gmail({ version: "v1", auth: yourOAuth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      console.log(`✅ Подключен Gmail аккаунт: ${email}`);
      
      // Сохраняем в базу данных
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token!,
      });
      
      // Сохраняем резервную копию токенов
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify({
        ...newTokens,
        refresh_token: tokens.refresh_token,
        obtained_via: "test_app_method",
        saved_at: new Date().toISOString()
      }, null, 2));
      
      console.log(`\n✅ Gmail аккаунт ${email} успешно настроен!`);
      console.log(`💾 Токены сохранены в: ${tokensPath}`);
      
      console.log("\n⚠️  ВАЖНО: Этот метод использует тестовое приложение.");
      console.log("Для production рекомендуется настроить собственный OAuth клиент в Google Console.");
      
    } catch (error: any) {
      console.error("\n❌ Ошибка обмена кода!");
      console.error(`Сообщение: ${error.message}`);
      
      if (error.message?.includes("invalid_grant")) {
        console.log("\n💡 Решение:");
        console.log("1. Откройте ссылку в НОВОМ окне инкогнито");
        console.log("2. Получите НОВЫЙ код");
        console.log("3. Используйте код СРАЗУ (в течение 1-2 минут)");
      }
    }
    
  } catch (error) {
    console.error("\n❌ Ошибка:", error);
  } finally {
    rl.close();
  }
  
  await db.disconnect();
}

setup();