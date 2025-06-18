/**
 * Локальный сервер для OAuth2 авторизации
 */

import http from "http";
import { URL } from "url";

/**
 * Запускает локальный сервер и ждет код авторизации
 * @param port - Порт сервера
 * @returns Код авторизации
 */
export function startLocalServer(port: number = 8080): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      try {
        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Ошибка авторизации</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #d32f2f; }
                .error { background: #ffebee; padding: 20px; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>❌ Ошибка авторизации</h1>
                <div class="error">
                  <strong>Ошибка:</strong> ${error}
                </div>
                <p>Закройте это окно и попробуйте снова.</p>
              </div>
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
            <!DOCTYPE html>
            <html>
            <head>
              <title>Авторизация успешна</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #4caf50; }
                .code-box { background: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; }
                code { font-size: 14px; background: #fff; padding: 10px; border: 1px solid #c8e6c9; border-radius: 3px; display: block; margin-top: 10px; word-break: break-all; }
                .success { color: #2e7d32; font-size: 18px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Авторизация успешна!</h1>
                <div class="code-box">
                  <p><strong>Код авторизации получен:</strong></p>
                  <code>${code}</code>
                </div>
                <p class="success">Вы можете закрыть это окно. Авторизация завершится автоматически.</p>
              </div>
            </body>
            </html>
          `);
          server.close();
          resolve(code);
          return;
        }

        // Корневая страница
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Gmail OAuth2</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #1976d2; }
              .loader { border: 4px solid #f3f3f3; border-top: 4px solid #1976d2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔐 Gmail OAuth2 Авторизация</h1>
              <div class="loader"></div>
              <p>Ожидание авторизации...</p>
              <p style="color: #666; font-size: 14px;">Если вы видите эту страницу, перейдите по ссылке авторизации в консоли.</p>
            </div>
          </body>
          </html>
        `);
      } catch (error: unknown) {
        res.writeHead(500);
        res.end("Internal Server Error");
        server.close();
        reject(error);
      }
    });

    server.on("error", (error) => {
      reject(new Error(`Ошибка сервера: ${error.message}`));
    });

    server.listen(port, () => {
      console.log(`\n🌐 Локальный сервер запущен на http://localhost:${port}`);
      console.log("⏳ Ожидание кода авторизации...\n");
    });

    // Таймаут 5 минут
    setTimeout(() => {
      server.close();
      reject(new Error("Таймаут ожидания авторизации (5 минут)"));
    }, 5 * 60 * 1000);
  });
}