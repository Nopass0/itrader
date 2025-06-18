// Check order status mapping

console.log('Bybit P2P Order Status Mapping:\n');

const statusMap = {
  5: 'Pending (NEW)',
  10: 'Payment pending/processing',
  20: 'Waiting for coin transfer',
  30: 'Appeal',
  40: 'Completed',
  50: 'Cancelled',
  60: 'Timeout'
};

console.log('Status codes:');
for (const [code, desc] of Object.entries(statusMap)) {
  console.log(`  ${code} = ${desc}`);
}

console.log('\nBased on the logs:');
console.log('- Orders with status 40 = Completed');
console.log('- Orders with status 50 = Cancelled');
console.log('\nOrderLinkingService is looking for statuses 5, 10, 20 (active orders)');
console.log('But all orders in the system have statuses 40, 50 (completed/cancelled)');
console.log('\nThis means there are no active orders to link!');