import { db } from './src/db/index';
const prisma = db.prisma;

async function checkChatAutomationLogs() {
  try {
    // Get logs from the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    console.log('Checking ChatAutomation logs from the last 10 minutes...\n');
    
    // Get all ChatAutomation logs
    const logs = await prisma.systemLog.findMany({
      where: {
        service: 'ChatAutomation',
        timestamp: {
          gte: tenMinutesAgo
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 100
    });
    
    console.log(`Found ${logs.length} logs\n`);
    
    // Group logs by level
    const errorLogs = logs.filter(log => log.level === 'ERROR');
    const warnLogs = logs.filter(log => log.level === 'WARN');
    const infoLogs = logs.filter(log => log.level === 'INFO');
    const debugLogs = logs.filter(log => log.level === 'DEBUG');
    
    // Show errors first
    if (errorLogs.length > 0) {
      console.log('=== ERRORS ===');
      errorLogs.forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.module || ''} - ${log.message}`);
        if (log.error) {
          try {
            console.log('  Error:', typeof log.error === 'string' ? JSON.parse(log.error) : log.error);
          } catch (e) {
            console.log('  Error:', log.error);
          }
        }
        if (log.stack) {
          console.log('  Stack:', log.stack);
        }
        if (log.data) {
          try {
            console.log('  Data:', typeof log.data === 'string' ? JSON.parse(log.data) : log.data);
          } catch (e) {
            console.log('  Data:', log.data);
          }
        }
        console.log();
      });
    }
    
    // Show warnings
    if (warnLogs.length > 0) {
      console.log('\n=== WARNINGS ===');
      warnLogs.forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.module || ''} - ${log.message}`);
        if (log.data) {
          try {
            console.log('  Data:', typeof log.data === 'string' ? JSON.parse(log.data) : log.data);
          } catch (e) {
            console.log('  Data:', log.data);
          }
        }
        console.log();
      });
    }
    
    // Show recent info logs related to message processing
    const messageProcessingLogs = infoLogs.filter(log => 
      log.message.includes('process') || 
      log.message.includes('send') || 
      log.message.includes('message') ||
      log.message.includes('chat') ||
      log.message.includes('payment')
    );
    
    if (messageProcessingLogs.length > 0) {
      console.log('\n=== MESSAGE PROCESSING LOGS ===');
      messageProcessingLogs.slice(0, 20).forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.module || ''} - ${log.message}`);
        if (log.data) {
          try {
            const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
            if (data.orderId || data.transactionId || data.messageCount !== undefined) {
              console.log('  Data:', data);
            }
          } catch (e) {
            console.log('  Data:', log.data);
          }
        }
      });
    }
    
    // Check for task execution logs
    const taskLogs = logs.filter(log => 
      log.message.includes('task') || 
      log.message.includes('Task') ||
      log.message.includes('chat_processor')
    );
    
    if (taskLogs.length > 0) {
      console.log('\n=== TASK EXECUTION ===');
      taskLogs.forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      });
    }
    
    // Check for initialization logs
    const initLogs = logs.filter(log => 
      log.message.includes('init') || 
      log.message.includes('start') ||
      log.message.includes('register')
    );
    
    if (initLogs.length > 0) {
      console.log('\n=== INITIALIZATION ===');
      initLogs.forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChatAutomationLogs();