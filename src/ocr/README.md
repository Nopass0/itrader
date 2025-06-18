# OCR Module

Модуль для обработки чеков с поддержкой OCR (Optical Character Recognition).

## Возможности

- 📄 **Извлечение текста из PDF** - прямое извлечение и fallback методы
- 🖼️ **OCR изображений** - через Tesseract OCR
- 📊 **Парсинг данных чека** - автоматическое извлечение ключевых полей
- ✅ **Валидация** - проверка корректности данных
- 🔍 **Сравнение с транзакциями** - сопоставление чеков с платежами

## Установка

### Зависимости Node.js

```bash
npm install decimal.js pdf-parse pdf-lib uuid
npm install --save-dev @types/uuid
```

### Системные зависимости

Для работы OCR необходим Tesseract:

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-rus

# macOS
brew install tesseract tesseract-lang

# Windows
# Скачайте установщик с https://github.com/UB-Mannheim/tesseract/wiki
```

## Использование

### Базовый пример

```typescript
import { OcrProcessor } from './ocr';
import { Decimal } from 'decimal.js';

const processor = new OcrProcessor();

// Обработка чека без ожидаемой суммы
const receipt = await processor.processReceipt('path/to/receipt.pdf');
console.log('Сумма:', receipt.amount.toString());
console.log('Банк:', receipt.bank);
console.log('Статус:', receipt.status);

// Обработка с ожидаемой суммой
const expectedAmount = new Decimal('1500.00');
const validatedReceipt = await processor.processReceiptWithAmount(
  'path/to/receipt.pdf',
  expectedAmount
);
```

### Сравнение с транзакцией

```typescript
const matches = await processor.compareWithTransaction({
  receipt: validatedReceipt,
  wallet: '+79001234567', // или последние 4 цифры карты
  bankName: 'T-Bank',
  amount: expectedAmount
});

if (matches) {
  console.log('Чек соответствует транзакции!');
}
```

### Прямая работа с процессором

```typescript
import { ReceiptProcessor } from './ocr';

const processor = new ReceiptProcessor({
  tesseractLang: 'rus+eng',
  tesseractPsm: 6,
  tempDir: '/tmp'
});

// Обработка буфера данных
const imageBuffer = await fs.readFile('receipt.jpg');
const receipt = await processor.processReceipt(
  imageBuffer,
  new Decimal('1000')
);
```

### Работа с PDF парсером

```typescript
import { PdfReceiptParser } from './ocr';

const parser = new PdfReceiptParser();

// Парсинг PDF файла
const receiptInfo = await parser.parseReceipt('receipt.pdf');

// Парсинг из буфера
const pdfBuffer = await fs.readFile('receipt.pdf');
const info = await parser.parseReceiptFromBuffer(pdfBuffer);
```

## Структура данных

### ReceiptData

```typescript
interface ReceiptData {
  amount: Decimal;        // Сумма платежа
  bank: string;          // Название банка
  reference: string;     // Номер операции
  timestamp: Date;       // Дата и время
  phone?: string;        // Номер телефона
  cardNumber?: string;   // Последние 4 цифры карты
  status?: string;       // Статус операции
  rawText?: string;      // Исходный текст
}
```

### Поддерживаемые банки

Модуль автоматически распознает следующие банки:
- T-Bank (Тинькофф)
- Сбербанк
- Альфа-Банк
- ВТБ
- Райффайзенбанк
- Газпромбанк
- И многие другие...

## Обработка ошибок

```typescript
import { OcrError, ValidationError } from './ocr';

try {
  const receipt = await processor.processReceipt('receipt.pdf');
} catch (error) {
  if (error instanceof OcrError) {
    console.error('Ошибка OCR:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Ошибка валидации:', error.message);
  }
}
```

## Настройки Tesseract

### PSM (Page Segmentation Mode)

- `3` - Полностью автоматическая сегментация (по умолчанию)
- `6` - Единый блок текста (рекомендуется для чеков)
- `11` - Разреженный текст

### Языки

- `rus` - Русский
- `eng` - Английский
- `rus+eng` - Оба языка (рекомендуется)

## Производительность

- PDF обработка: ~100-500ms
- OCR изображения: ~1-3s (зависит от размера)
- Валидация: <10ms

## Ограничения

- Максимальный размер изображения: зависит от памяти
- Поддерживаемые форматы: PDF, PNG, JPG, TIFF
- Точность OCR: ~95% для качественных изображений

## Лицензия

MIT