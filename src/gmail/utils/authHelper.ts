/**
 * Вспомогательные функции для авторизации
 */

import http from "http";
import { URL } from "url";
import open from "open";

/**
 * Запускает локальный сервер для получения кода авторизации
 * @param port - Порт для сервера
 * @returns Promise с кодом авторизации
 */
export async function startAuthServer(port: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #d32f2f;">❌ Ошибка авторизации</h1>
              <p>Ошибка: ${error}</p>
              <p>Закройте это окно и попробуйте снова.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`Ошибка авторизации: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #4caf50;">✅ Авторизация успешна!</h1>
              <p>Код получен. Вы можете закрыть это окно.</p>
              <div style="margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 5px;">
                <p style="margin: 0; color: #666;">Код авторизации:</p>
                <code style="display: block; margin-top: 10px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 3px; word-break: break-all;">
                  ${code}
                </code>
              </div>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
        return;
      }

      // Главная страница
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>🔐 Gmail OAuth2 Авторизация</h1>
            <p>Ожидание авторизации...</p>
          </body>
        </html>
      `);
    });

    server.on("error", reject);

    server.listen(port, () => {
      console.log(`\n🌐 Сервер авторизации запущен на http://localhost:${port}`);
    });
  });
}

/**
 * Автоматизированный процесс авторизации с локальным сервером
 * @param authUrl - URL для авторизации
 * @param port - Порт для локального сервера
 * @returns Код авторизации
 */
export async function authorizeWithLocalServer(
  authUrl: string,
  port: number = 3000
): Promise<string> {
  console.log("\n🚀 Запуск автоматизированной авторизации...");

  // Запускаем сервер
  const codePromise = startAuthServer(port);

  // Открываем браузер
  console.log("📱 Открываем браузер для авторизации...");
  try {
    await open(authUrl);
  } catch (error: unknown) {
    console.log("\n⚠️  Не удалось автоматически открыть браузер.");
    console.log("Откройте следующую ссылку вручную:");
    console.log(authUrl);
  }

  // Ждем код
  console.log("\n⏳ Ожидание авторизации...");
  const code = await codePromise;
  
  console.log("\n✅ Код авторизации получен!");
  return code;
}

/**
 * Извлекает код из URL редиректа
 * @param redirectUrl - Полный URL после редиректа
 * @returns Код авторизации или null
 */
export function extractCodeFromUrl(redirectUrl: string): string | null {
  try {
    const url = new URL(redirectUrl);
    return url.searchParams.get("code");
  } catch {
    // Попробуем извлечь код регулярным выражением
    const match = redirectUrl.match(/[?&]code=([^&]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Помощник для ввода URL редиректа
 * @returns Код авторизации
 */
export async function promptForRedirectUrl(): Promise<string> {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    console.log("\n📋 После авторизации вы будете перенаправлены на страницу вида:");
    console.log("   http://localhost/?code=4/0AUJR-x52Q2Qys8...&scope=...");
    console.log("\n🔗 Скопируйте ПОЛНЫЙ URL из адресной строки браузера:\n");

    readline.question("URL: ", (url: string) => {
      readline.close();
      
      const code = extractCodeFromUrl(url.trim());
      if (code) {
        console.log("\n✅ Код извлечен:", code.substring(0, 20) + "...");
        resolve(code);
      } else {
        reject(new Error("Не удалось извлечь код из URL"));
      }
    });
  });
}