import { db } from "./db";
import { GmailClient } from "./gmail";
import { OAuth2Manager } from "./gmail/utils/oauth2";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  try {
    console.log("\n=== Gmail Setup (Ручная настройка) ===\n");
    
    // Проверяем файл с credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    try {
      await fs.access(credentialsPath);
    } catch {
      console.error("ОШИБКА: Файл gmail-credentials.json не найден!");
      console.log(`Поместите файл сюда: ${credentialsPath}`);
      console.log("\nИнструкции:");
      console.log("1. Перейдите в Google Cloud Console");
      console.log("2. Создайте OAuth 2.0 Client ID (тип: Desktop)");
      console.log("3. Скачайте JSON файл");
      console.log("4. Переименуйте в gmail-credentials.json");
      console.log("5. Поместите в папку data/");
      process.exit(1);
    }

    // Загружаем credentials
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;

    // Создаем OAuth2Manager
    const oauth2Manager = new OAuth2Manager(credentials, undefined, false);
    const authUrl = oauth2Manager.getAuthUrl();

    console.log("Шаг 1: Откройте эту ссылку в браузере (лучше в режиме инкогнито):");
    console.log("\n" + authUrl + "\n");
    
    console.log("Шаг 2: Войдите в аккаунт Google и разрешите доступ");
    console.log("\nШаг 3: После авторизации вы увидите URL вида:");
    console.log("http://localhost/?code=4/0AUJR-x6PQ...&scope=...\n");
    
    console.log("Шаг 4: Скопируйте ТОЛЬКО код (часть между 'code=' и '&scope')");
    console.log("Пример: 4/0AUJR-x6PQwB0qU13ldbZXDhDKbvyqA0YgncuXu55jI8D66HlXW_QDCbgoWUOQk9RQSczzw\n");

    const code = await question("Введите код авторизации: ");

    if (!code || code.trim().length === 0) {
      console.error("\nОШИБКА: Код не введен!");
      process.exit(1);
    }

    console.log("\nОбмениваем код на токены...");
    
    try {
      const tokens = await oauth2Manager.getTokenFromCode(code.trim());

      // Создаем клиент и получаем профиль
      const client = new GmailClient(oauth2Manager);
      await client.setTokens(tokens);
      const profile = await client.getUserProfile();

      // Сохраняем в базу данных
      await db.upsertGmailAccount({
        email: profile.emailAddress || "unknown",
        refreshToken: tokens.refresh_token || "",
      });

      console.log(`\n✅ УСПЕХ! Gmail аккаунт ${profile.emailAddress} подключен!`);
      console.log("\nТеперь можно запускать Itrader!");
      
    } catch (error: any) {
      console.error("\n❌ Ошибка при обмене кода:", error.message);
      
      if (error.message && error.message.includes('invalid_grant')) {
        console.log("\n💡 Как исправить ошибку 'invalid_grant':");
        console.log("1. Используйте СВЕЖИЙ код (не используйте старые коды)");
        console.log("2. Откройте ссылку в НОВОМ окне браузера в режиме инкогнито");
        console.log("3. Завершите процесс БЫСТРО (в течение 1-2 минут)");
        console.log("4. Копируйте ТОЛЬКО код, не весь URL");
        console.log("5. Убедитесь что в Google Cloud Console настроен redirect URI: http://localhost/");
        console.log("\nПопробуйте еще раз!");
      }
    }
    
  } catch (error: any) {
    console.error("\n❌ Ошибка настройки:", error.message || error);
  } finally {
    rl.close();
    await db.disconnect();
  }
}

console.log("Gmail Setup - Ручная настройка");
console.log("==============================");
console.log("\nЭтот скрипт использует ручной ввод кода для обхода проблем с сервером.\n");

setup();