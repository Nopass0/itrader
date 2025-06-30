import { getMailSlurpService } from './src/services/mailslurpService';

async function testEmailDetails() {
  try {
    console.log('Getting MailSlurp service...');
    const mailslurpService = await getMailSlurpService();
    
    console.log('Getting first email with attachments...');
    const emails = await mailslurpService.getAllEmails({ limit: 10 });
    
    const emailWithAttachment = emails.find(e => e.attachments && e.attachments.length > 0);
    
    if (emailWithAttachment) {
      console.log('\nEmail with attachment found:');
      console.log('Email ID:', emailWithAttachment.id);
      console.log('Subject:', emailWithAttachment.subject);
      console.log('Attachments:', JSON.stringify(emailWithAttachment.attachments, null, 2));
      
      // Get full email details
      console.log('\nGetting full email details...');
      const mailslurp = (mailslurpService as any).mailslurp;
      const emailController = mailslurp.emailController;
      
      const fullEmail = await emailController.getEmail({
        emailId: emailWithAttachment.id
      });
      
      console.log('\nFull email object keys:', Object.keys(fullEmail));
      console.log('Full email attachments:', JSON.stringify(fullEmail.attachments, null, 2));
      
      // Check if attachments have additional metadata
      if (fullEmail.attachments && fullEmail.attachments.length > 0) {
        console.log('\nFirst attachment details:');
        const att = fullEmail.attachments[0];
        console.log('All properties:', Object.keys(att));
        console.log('Full attachment object:', JSON.stringify(att, null, 2));
      }
    } else {
      console.log('No emails with attachments found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testEmailDetails();