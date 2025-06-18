import { db } from './src/db';

async function checkLogs() {
  console.log('Checking OrderLinkingService logs...\n');
  
  const logs = await db.prisma.systemLog.findMany({
    where: {
      OR: [
        { service: 'OrderLinkingService' },
        { message: { contains: 'OrderLinking' } },
        { message: { contains: 'getAllActiveOrders' } }
      ]
    },
    orderBy: { timestamp: 'desc' },
    take: 30
  });
  
  console.log(`Found ${logs.length} logs\n`);
  
  logs.forEach(log => {
    const time = log.timestamp.toLocaleString();
    console.log(`[${time}] ${log.service}/${log.module || '-'} ${log.level}: ${log.message}`);
    if (log.data) {
      console.log(`  Data: ${JSON.stringify(log.data)}`);
    }
  });
  
  // Check specifically for start message
  const startLog = await db.prisma.systemLog.findFirst({
    where: {
      service: 'OrderLinkingService',
      message: { contains: 'Starting OrderLinkingService' }
    },
    orderBy: { timestamp: 'desc' }
  });
  
  if (startLog) {
    console.log(`\nOrderLinkingService started at: ${startLog.timestamp.toLocaleString()}`);
  } else {
    console.log('\nNo start log found for OrderLinkingService!');
  }
  
  await db.disconnect();
}

checkLogs().catch(console.error);