/**
 * Пример использования типизированного парсера чеков Тинькофф
 */

import { 
  TinkoffReceiptParser, 
  TransferType, 
  type ParsedReceipt,
  ReceiptParseError 
} from "../";

async function example() {
  const parser = new TinkoffReceiptParser();
  
  try {
    // Парсинг чека из файла
    const receipt = await parser.parseReceiptFromFile("path/to/receipt.pdf");
    
    // Общие поля для всех типов чеков
    console.log("Дата и время:", receipt.datetime);
    console.log("Сумма:", receipt.amount, "₽");
    console.log("Статус:", receipt.status); // Всегда "SUCCESS"
    console.log("Отправитель:", receipt.sender);
    
    // Обработка в зависимости от типа перевода
    switch (receipt.transferType) {
      case TransferType.BY_PHONE:
        console.log("Тип: Перевод по номеру телефона");
        console.log("Телефон получателя:", receipt.recipientPhone);
        if (receipt.recipientBank) {
          console.log("Банк получателя:", receipt.recipientBank);
        }
        break;
        
      case TransferType.TO_TBANK:
        console.log("Тип: Перевод клиенту Т-Банка");
        console.log("Получатель:", receipt.recipientName);
        console.log("Карта получателя:", receipt.recipientCard);
        break;
        
      case TransferType.TO_CARD:
        console.log("Тип: Перевод на карту");
        console.log("Карта получателя:", receipt.recipientCard);
        console.log("Комиссия:", receipt.commission, "₽");
        break;
    }
    
    // Комиссия может быть у любого типа (кроме переводов на карту, где она обязательна)
    if ('commission' in receipt && receipt.commission !== undefined) {
      console.log("Комиссия:", receipt.commission, "₽");
    }
    
  } catch (error) {
    if (error instanceof ReceiptParseError) {
      console.error("Ошибка парсинга чека:", error.message);
      // Чек бракованный или не соответствует формату
    } else {
      console.error("Неизвестная ошибка:", error);
    }
  }
}

// Пример работы с буфером PDF
async function parseFromBuffer(pdfBuffer: Buffer) {
  const parser = new TinkoffReceiptParser();
  
  try {
    const receipt = await parser.parseReceiptFromBuffer(pdfBuffer);
    return receipt;
  } catch (error) {
    console.error("Ошибка:", error);
    throw error;
  }
}

// Пример типизированной обработки
function processReceipt(receipt: ParsedReceipt) {
  // TypeScript автоматически определит доступные поля
  // в зависимости от типа перевода
  
  if (receipt.transferType === TransferType.BY_PHONE) {
    // Здесь TypeScript знает, что есть поля recipientPhone и recipientBank
    console.log("Телефон:", receipt.recipientPhone);
  } else if (receipt.transferType === TransferType.TO_CARD) {
    // Здесь TypeScript знает, что есть обязательное поле commission
    console.log("Комиссия за перевод на карту:", receipt.commission);
  }
}