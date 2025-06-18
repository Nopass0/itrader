/**
 * Продвинутый пример использования Gmail модуля
 */

import { GmailManager, EmailParser } from "../index";
import path from "path";
import fs from "fs/promises";

async function advancedExample() {
  console.log("🚀 Gmail API - Продвинутый пример\n");

  // 1. Создаем менеджер и загружаем существующие аккаунты
  const manager = await GmailManager.fromCredentialsFile(
    path.join(__dirname, "../../../credentials.json"),
    {
      tokensDir: "./data/gmail-tokens",
      autoSaveTokens: true,
    }
  );

  await manager.initialize();

  // Загружаем сохраненные аккаунты
  const loadedCount = await manager.loadAllAccounts();
  console.log(`📥 Загружено ${loadedCount} сохраненных аккаунтов\n`);

  // Если нет аккаунтов, добавляем новый
  if (loadedCount === 0) {
    console.log("Добавьте аккаунт:");
    await manager.addAccountInteractive();
  }

  // Получаем первый аккаунт
  const accounts = manager.getAccounts();
  if (accounts.length === 0) {
    console.log("Нет доступных аккаунтов");
    return;
  }

  const email = accounts[0].email;
  console.log(`📧 Работаем с аккаунтом: ${email}\n`);

  // 2. Парсер писем для извлечения платежной информации
  const parser = new EmailParser();

  // 3. Ищем платежные письма
  console.log("💳 Поиск платежных писем:");
  
  // Ищем письма от банков и платежных систем
  const bankEmails = await manager.getEmails(email, {
    query: "from:(sberbank OR tinkoff OR alfa-bank OR vtb OR paypal OR qiwi)",
    maxResults: 20,
  });

  const paymentEmails = parser.extractPaymentEmails(bankEmails.messages);
  console.log(`Найдено ${paymentEmails.length} платежных писем:\n`);

  paymentEmails.forEach((receipt, index) => {
    console.log(`${index + 1}. Платеж от ${receipt.sender || "Неизвестно"}`);
    console.log(`   Дата: ${receipt.date?.toLocaleString()}`);
    if (receipt.amount) {
      console.log(`   Сумма: ${receipt.amount.toString()} руб`);
    }
    if (receipt.transactionId) {
      console.log(`   ID транзакции: ${receipt.transactionId}`);
    }
    if (receipt.pdfAttachment) {
      console.log(`   📎 PDF чек: ${receipt.pdfAttachment.filename}`);
    }
    console.log();
  });

  // 4. Скачиваем PDF чеки
  console.log("📥 Скачивание PDF чеков:");
  const receiptsDir = "./data/receipts";
  await fs.mkdir(receiptsDir, { recursive: true });

  let downloadedCount = 0;
  for (const receipt of paymentEmails) {
    if (receipt.pdfAttachment) {
      const filename = `receipt_${receipt.email.id}_${receipt.pdfAttachment.filename}`;
      const filePath = path.join(receiptsDir, filename);

      try {
        await manager.downloadPdfToFile(
          email,
          receipt.email.id,
          receipt.pdfAttachment.id,
          filePath
        );
        downloadedCount++;
        console.log(`✅ Скачан: ${filename}`);
      } catch (error: unknown) {
        console.error(`❌ Ошибка скачивания ${filename}:`, error);
      }
    }
  }

  console.log(`\n📊 Скачано ${downloadedCount} PDF чеков в ${receiptsDir}`);

  // 5. Группировка писем по отправителям
  console.log("\n📊 Группировка по отправителям:");
  const grouped = parser.groupBySender(bankEmails.messages);

  grouped.forEach((messages, sender) => {
    console.log(`\n${sender}: ${messages.length} писем`);
    
    // Показываем последние 3 письма
    messages.slice(0, 3).forEach(msg => {
      console.log(`  - ${msg.subject} (${msg.date?.toLocaleDateString()})`);
    });
  });

  // 6. Работа с конкретным письмом
  if (bankEmails.messages.length > 0) {
    console.log("\n📧 Детальная информация о первом письме:");
    const firstEmail = bankEmails.messages[0];
    
    console.log(`ID: ${firstEmail.id}`);
    console.log(`От: ${firstEmail.from}`);
    console.log(`Тема: ${firstEmail.subject}`);
    console.log(`Дата: ${firstEmail.date?.toLocaleString()}`);
    console.log(`Прочитано: ${!firstEmail.isUnread}`);
    console.log(`Важное: ${firstEmail.isImportant}`);
    console.log(`Помечено: ${firstEmail.isStarred}`);

    // Помечаем как прочитанное
    if (firstEmail.isUnread) {
      await manager.markAsRead(email, firstEmail.id);
      console.log("✅ Помечено как прочитанное");
    }

    // Скачиваем все PDF из письма
    if (firstEmail.attachments && firstEmail.attachments.length > 0) {
      console.log(`\n📎 Вложения (${firstEmail.attachments.length}):`);
      
      const pdfAttachments = await manager.downloadPdfAttachments(
        email,
        firstEmail.id
      );

      for (const pdf of pdfAttachments) {
        console.log(`- ${pdf.filename} (${pdf.size} байт)`);
        
        // Сохраняем в файл
        if (pdf.data) {
          const pdfPath = path.join(receiptsDir, `detail_${pdf.filename}`);
          const buffer = Buffer.from(pdf.data, "base64");
          await fs.writeFile(pdfPath, buffer);
          console.log(`  ✅ Сохранен: ${pdfPath}`);
        }
      }
    }
  }

  // 7. Поиск с пагинацией
  console.log("\n📄 Пагинация результатов:");
  let pageToken: string | undefined;
  let totalMessages = 0;
  let pageCount = 0;

  do {
    const result = await manager.getEmails(email, {
      maxResults: 10,
      pageToken,
      after: "2024/1/1",
    });

    totalMessages += result.messages.length;
    pageCount++;
    
    console.log(`Страница ${pageCount}: ${result.messages.length} писем`);
    
    pageToken = result.nextPageToken;
  } while (pageToken && pageCount < 3); // Ограничиваем 3 страницами для примера

  console.log(`\nВсего загружено: ${totalMessages} писем`);
}

// Вспомогательная функция для OAuth flow через веб
async function webAuthExample() {
  console.log("\n🌐 Пример веб-авторизации:");
  
  // Создаем менеджер
  const manager = await GmailManager.fromCredentialsFile(
    path.join(__dirname, "../../../credentials.json")
  );

  // Получаем URL для авторизации
  const authUrl = manager.getAuthUrl("my-state-123");
  console.log("\nURL для авторизации:");
  console.log(authUrl);
  
  console.log("\nПосле авторизации вы получите код. Используйте его так:");
  console.log("const email = await manager.addAccountWithAuthCode('полученный-код');");
}

// Запускаем пример
if (require.main === module) {
  advancedExample()
    .then(() => webAuthExample())
    .then(() => console.log("\n✅ Пример завершен"))
    .catch((error: unknown) => {
      console.error("❌ Ошибка:", error);
      process.exit(1);
    });
}