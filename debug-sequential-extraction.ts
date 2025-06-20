/**
 * Debug sequential extraction logic
 */

const text = `20.06.2025 17:15:07

Итого
Перевод

2 700 i
По номеру телефона

Статус

Успешно

Сумма

2 700 i

Комиссия

Без комиссии

Отправитель

Алексей Крутских

Телефон получателя

+7 (982) 446-98-64

Получатель
Банк получателя
Счет списания

Алексей Б.
Озон Банк (Ozon)
408178101001****0186

Идентификатор операции B51711415078711H00001400115
СБП
30503

Квитанция № 1-24-984-926-392
По вопросам зачисления обращайтесь к получателю
Служба поддержки fb@tbank.ru`;

const lines = text.split('\n').map(l => l.trim()).filter(l => l);

console.log('==== SEQUENTIAL EXTRACTION DEBUG ====');

const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];

// Find all label positions
const labelPositions: { [key: string]: number } = {};
labels.forEach(label => {
  const idx = lines.indexOf(label);
  if (idx !== -1) {
    labelPositions[label] = idx;
  }
});

console.log('Label positions:', labelPositions);

// Find the start of the value block (after the last label)
const lastLabelIdx = Math.max(...Object.values(labelPositions));
let valueStartIdx = lastLabelIdx + 1;

console.log('Last label index:', lastLabelIdx);
console.log('Last label:', lines[lastLabelIdx]);
console.log('Value start index:', valueStartIdx);

// Check if the next line is empty and skip it
if (valueStartIdx < lines.length && lines[valueStartIdx].trim() === '') {
  valueStartIdx++;
  console.log('Skipped empty line, new value start index:', valueStartIdx);
}

// Extract values in the same order as labels
const sortedLabels = Object.keys(labelPositions).sort((a, b) => labelPositions[a] - labelPositions[b]);

console.log('\nSorted labels:', sortedLabels);
console.log('\nAttempting to extract values:');

sortedLabels.forEach((label, index) => {
  const valueIdx = valueStartIdx + index;
  console.log(`\n${label}:`);
  console.log(`  - Label at index: ${labelPositions[label]}`);
  console.log(`  - Looking for value at index: ${valueIdx}`);
  
  if (valueIdx < lines.length) {
    const value = lines[valueIdx];
    console.log(`  - Found value: "${value}"`);
    
    // Check what should be extracted
    switch(label) {
      case 'Отправитель':
        const matches = value && value.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/);
        console.log(`  - Matches sender pattern: ${!!matches}`);
        break;
    }
  } else {
    console.log(`  - Index out of bounds!`);
  }
});

console.log('\n==== ACTUAL VALUES IN RECEIPT ====');
console.log('Lines around labels:');
labels.forEach(label => {
  const idx = labelPositions[label];
  if (idx !== undefined) {
    console.log(`\n${label} (at ${idx}):`);
    if (idx + 1 < lines.length) {
      console.log(`  Next line (${idx + 1}): "${lines[idx + 1]}"`);
    }
    if (idx + 2 < lines.length) {
      console.log(`  Line +2 (${idx + 2}): "${lines[idx + 2]}"`);
    }
  }
});