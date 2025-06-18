import { db } from './src/db/index';
const prisma = db.prisma;

async function checkOrderMonitoringLogs() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    console.log('Checking order monitoring and chat synchronization logs...\n');
    
    // Check InstantOrderMonitor logs
    const instantMonitorLogs = await prisma.systemLog.findMany({
      where: {
        service: 'InstantOrderMonitor',
        timestamp: { gte: tenMinutesAgo }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    
    console.log(`=== INSTANT ORDER MONITOR (${instantMonitorLogs.length} logs) ===`);
    instantMonitorLogs.slice(0, 10).forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      if (log.data) {
        try {
          const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
          if (data.orderId || data.messageCount !== undefined) {
            console.log('  Data:', data);
          }
        } catch (e) {}
      }
    });
    
    // Check ActiveOrdersMonitor logs
    const activeOrdersLogs = await prisma.systemLog.findMany({
      where: {
        service: 'ActiveOrdersMonitor',
        timestamp: { gte: tenMinutesAgo }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    
    console.log(`\n=== ACTIVE ORDERS MONITOR (${activeOrdersLogs.length} logs) ===`);
    activeOrdersLogs.slice(0, 10).forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      if (log.data) {
        try {
          const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
          if (data.orderId || data.orders || data.messageCount !== undefined) {
            console.log('  Data:', data);
          }
        } catch (e) {}
      }
    });
    
    // Check for chat sync logs
    const chatSyncLogs = await prisma.systemLog.findMany({
      where: {
        OR: [
          { message: { contains: 'chat' } },
          { message: { contains: 'Chat' } },
          { message: { contains: 'message' } },
          { message: { contains: 'Message' } }
        ],
        timestamp: { gte: tenMinutesAgo },
        service: {
          in: ['InstantOrderMonitor', 'ActiveOrdersMonitor', 'BybitP2PManager']
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    
    console.log(`\n=== CHAT SYNCHRONIZATION (${chatSyncLogs.length} logs) ===`);
    chatSyncLogs.slice(0, 10).forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] [${log.service}] ${log.message}`);
    });
    
    // Check if messages are being saved
    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        createdAt: { gte: tenMinutesAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\n=== RECENT CHAT MESSAGES (${recentMessages.length}) ===`);
    recentMessages.forEach(msg => {
      console.log(`[${msg.createdAt.toISOString()}] ${msg.sender}: ${msg.content.substring(0, 100)}...`);
      console.log(`  Transaction: ${msg.transactionId}, Processed: ${msg.isProcessed}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrderMonitoringLogs();