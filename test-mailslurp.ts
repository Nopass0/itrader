import { getMailSlurpService } from './src/services/mailslurpService';
import { createLogger } from './src/logger';

const logger = createLogger('TestMailSlurp');

async function testMailSlurp() {
  try {
    console.log('Getting MailSlurp service...');
    logger.info('Getting MailSlurp service...');
    const mailslurpService = await getMailSlurpService();
    
    console.log('Service obtained, checking inboxes...');
    logger.info('Service obtained, checking inboxes...');
    const inboxes = mailslurpService.getInboxes();
    console.log(`Found ${inboxes.length} inboxes:`, inboxes.map(i => ({
      id: i.id,
      email: i.emailAddress
    })));
    logger.info(`Found ${inboxes.length} inboxes:`, inboxes.map(i => ({
      id: i.id,
      email: i.emailAddress
    })));
    
    console.log('Testing getAllEmails...');
    logger.info('Testing getAllEmails...');
    const emails = await mailslurpService.getAllEmails({ limit: 10 });
    console.log(`Found ${emails.length} emails`);
    logger.info(`Found ${emails.length} emails`);
    
    if (emails.length > 0) {
      console.log('First email:', {
        id: emails[0].id,
        subject: emails[0].subject,
        from: emails[0].from,
        attachments: emails[0].attachments?.length || 0
      });
      logger.info('First email:', {
        id: emails[0].id,
        subject: emails[0].subject,
        from: emails[0].from,
        attachments: emails[0].attachments?.length || 0
      });
    } else {
      console.log('No emails found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testMailSlurp();