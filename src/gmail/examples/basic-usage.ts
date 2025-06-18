/**
 * Базовый пример использования Gmail модуля
 */

import { GmailManager } from "../index";
import path from "path";

async function basicExample() {
  console.log("🚀 Gmail API - Базовый пример\n");

  // 1. Создаем менеджер из файла credentials
  const manager = await GmailManager.fromCredentialsFile(
    path.join(__dirname, "../../../credentials.json"),
    {
      tokensDir: "./data/gmail-tokens",
      autoSaveTokens: true,
    }
  );

  await manager.initialize();

  // 2. Добавляем новый аккаунт интерактивно
  console.log("📧 Добавление Gmail аккаунта:");
  const email = await manager.addAccountInteractive();
  console.log(`✅ Аккаунт ${email} успешно добавлен\n`);

  // 3. Получаем последние письма
  console.log("📬 Получение последних писем:");
  const emails = await manager.getEmails(email, {
    maxResults: 10,
  });

  console.log(`Найдено ${emails.messages.length} писем:`);
  emails.messages.forEach((msg, index) => {
    console.log(`${index + 1}. От: ${msg.from}`);
    console.log(`   Тема: ${msg.subject}`);
    console.log(`   Дата: ${msg.date?.toLocaleString()}`);
    console.log(`   Вложения: ${msg.attachments?.length || 0}`);
    console.log();
  });

  // 4. Поиск писем за последнюю неделю
  console.log("📅 Письма за последнюю неделю:");
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentEmails = await manager.getEmailsByDateRange(
    email,
    weekAgo,
    undefined,
    { maxResults: 5 }
  );

  console.log(`Найдено ${recentEmails.messages.length} писем за неделю\n`);

  // 5. Поиск писем с PDF вложениями
  console.log("📎 Письма с PDF файлами:");
  const pdfEmails = await manager.getEmailsWithPdfAttachments(email, {
    maxResults: 5,
  });

  console.log(`Найдено ${pdfEmails.messages.length} писем с PDF:`);
  for (const msg of pdfEmails.messages) {
    console.log(`- ${msg.subject}`);
    const pdfs = msg.attachments?.filter(
      a => a.mimeType === "application/pdf"
    );
    pdfs?.forEach(pdf => {
      console.log(`  📄 ${pdf.filename} (${pdf.size} байт)`);
    });
  }

  // 6. Получение информации об аккаунтах
  console.log("\n👥 Информация об аккаунтах:");
  const accounts = manager.getAccounts();
  accounts.forEach(acc => {
    console.log(`- ${acc.email}`);
    console.log(`  Активен: ${acc.isActive}`);
    console.log(`  Последнее использование: ${acc.lastUsed?.toLocaleString()}`);
  });
}

// Запускаем пример
if (require.main === module) {
  basicExample()
    .then(() => console.log("\n✅ Пример завершен"))
    .catch((error: unknown) => {
      console.error("❌ Ошибка:", error);
      process.exit(1);
    });
}