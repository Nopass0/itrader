import fs from "fs/promises";
import path from "path";

async function checkConfig() {
  try {
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const content = await fs.readFile(credentialsPath, 'utf-8');
    const creds = JSON.parse(content);
    const oauth = creds.installed || creds.web || creds;

    console.log("\n=== Проверка конфигурации Gmail ===\n");
    console.log("Client ID:", oauth.client_id ? "✓ Найден" : "✗ ОТСУТСТВУЕТ");
    console.log("Client Secret:", oauth.client_secret ? "✓ Найден" : "✗ ОТСУТСТВУЕТ");
    console.log("Auth URI:", oauth.auth_uri || "ОТСУТСТВУЕТ");
    console.log("Token URI:", oauth.token_uri || "ОТСУТСТВУЕТ");
    console.log("\nRedirect URIs:");
    
    if (oauth.redirect_uris && oauth.redirect_uris.length > 0) {
      oauth.redirect_uris.forEach((uri: string, i: number) => {
        console.log(`  ${i + 1}. ${uri}`);
      });
      console.log("\n⚠️  Убедитесь, что в Google Cloud Console настроен один из этих redirect URI");
    } else {
      console.log("  ✗ Не найдены - будет использоваться http://localhost/");
      console.log("\n⚠️  В Google Cloud Console добавьте redirect URI: http://localhost/");
    }

    console.log("\n📋 Что нужно сделать:");
    console.log("1. Перейдите в Google Cloud Console");
    console.log("2. Откройте ваш OAuth 2.0 Client ID");
    console.log("3. В разделе 'Authorized redirect URIs' добавьте:");
    console.log("   - http://localhost/");
    console.log("   - http://localhost:3000/oauth2callback");
    console.log("4. Сохраните изменения");
    console.log("5. Подождите 5-10 минут (изменения применяются не сразу)");
    
  } catch (error) {
    console.error("Ошибка чтения конфигурации:", error);
  }
}

checkConfig();