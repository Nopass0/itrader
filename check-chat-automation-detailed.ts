import { db } from './src/db/index';
const prisma = db.prisma;

async function checkChatAutomationDetails() {
  try {
    // Get logs from the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    console.log('Checking ChatAutomation detailed logs...\n');
    
    // Get all ChatAutomation logs
    const logs = await prisma.systemLog.findMany({
      where: {
        service: 'ChatAutomation',
        timestamp: {
          gte: thirtyMinutesAgo
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 500
    });
    
    console.log(`Found ${logs.length} logs from the last 30 minutes\n`);
    
    // Look for specific patterns
    const patterns = {
      errors: logs.filter(log => log.level === 'ERROR'),
      warnings: logs.filter(log => log.level === 'WARN'),
      messagesSent: logs.filter(log => log.message.includes('sent') || log.message.includes('Sent')),
      messagesFailed: logs.filter(log => log.message.includes('fail') || log.message.includes('Failed')),
      processing: logs.filter(log => log.message.includes('Processing')),
      unprocessed: logs.filter(log => log.message.includes('unprocessed')),
      paymentDetails: logs.filter(log => log.message.includes('payment details') || log.message.includes('Payment details')),
      authentication: logs.filter(log => log.message.includes('auth') || log.message.includes('Auth')),
      client: logs.filter(log => log.message.includes('client') || log.message.includes('Client')),
      tasks: logs.filter(log => log.message.includes('task') || log.message.includes('Task'))
    };
    
    // Show errors
    if (patterns.errors.length > 0) {
      console.log('=== ERRORS (Last 10) ===');
      patterns.errors.slice(0, 10).forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
        if (log.error) {
          try {
            const error = typeof log.error === 'string' ? JSON.parse(log.error) : log.error;
            console.log('  Error details:', error);
          } catch (e) {
            console.log('  Error:', log.error);
          }
        }
        if (log.stack) {
          console.log('  Stack trace:', log.stack.split('\\n').slice(0, 3).join('\\n'));
        }
        console.log();
      });
    } else {
      console.log('=== NO ERRORS FOUND ===\n');
    }
    
    // Show warnings
    if (patterns.warnings.length > 0) {
      console.log('=== WARNINGS (Last 5) ===');
      patterns.warnings.slice(0, 5).forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
        if (log.data) {
          try {
            const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
            console.log('  Data:', data);
          } catch (e) {
            console.log('  Data:', log.data);
          }
        }
        console.log();
      });
    }
    
    // Show messages sent
    console.log(`=== MESSAGES SENT: ${patterns.messagesSent.length} ===`);
    if (patterns.messagesSent.length > 0) {
      patterns.messagesSent.slice(0, 5).forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      });
    }
    
    // Show messages failed
    console.log(`\n=== MESSAGES FAILED: ${patterns.messagesFailed.length} ===`);
    if (patterns.messagesFailed.length > 0) {
      patterns.messagesFailed.slice(0, 5).forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      });
    }
    
    // Show unprocessed message checks
    console.log(`\n=== UNPROCESSED MESSAGE CHECKS ===`);
    const unprocessedChecks = patterns.unprocessed.slice(0, 10);
    unprocessedChecks.forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      if (log.data) {
        try {
          const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
          if (data.messageCount !== undefined) {
            console.log(`  Found ${data.messageCount} unprocessed messages`);
          }
        } catch (e) {}
      }
    });
    
    // Check if the service is running
    const recentLogs = logs.filter(log => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return log.timestamp >= fiveMinutesAgo;
    });
    
    console.log(`\n=== SERVICE STATUS ===`);
    console.log(`Logs in last 5 minutes: ${recentLogs.length}`);
    
    // Check for task execution
    const taskLogs = patterns.tasks.filter(log => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return log.timestamp >= fiveMinutesAgo;
    });
    console.log(`Task executions in last 5 minutes: ${taskLogs.length}`);
    
    // Check database for unprocessed messages
    console.log('\n=== DATABASE CHECK ===');
    const unprocessedMessages = await prisma.chatMessage.count({
      where: { isProcessed: false }
    });
    console.log(`Unprocessed messages in database: ${unprocessedMessages}`);
    
    // Check active transactions
    const activeTransactions = await prisma.transaction.count({
      where: {
        status: {
          in: ['pending', 'chat_started', 'waiting_payment']
        }
      }
    });
    console.log(`Active transactions: ${activeTransactions}`);
    
    // Show sample of recent unprocessed messages
    if (unprocessedMessages > 0) {
      const sampleMessages = await prisma.chatMessage.findMany({
        where: { isProcessed: false },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: true
        }
      });
      
      console.log('\n=== SAMPLE UNPROCESSED MESSAGES ===');
      sampleMessages.forEach(msg => {
        console.log(`- Message ID: ${msg.id}`);
        console.log(`  Transaction: ${msg.transactionId}`);
        console.log(`  Sender: ${msg.sender}`);
        console.log(`  Content: ${msg.content.substring(0, 100)}...`);
        console.log(`  Created: ${msg.createdAt.toISOString()}`);
        console.log();
      });
    }
    
  } catch (error) {
    console.error('Error checking logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChatAutomationDetails();