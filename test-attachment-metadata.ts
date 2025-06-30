import { getMailSlurpService } from './src/services/mailslurpService';

async function testAttachmentMetadata() {
  try {
    console.log('Getting MailSlurp service...');
    const mailslurpService = await getMailSlurpService();
    
    const mailslurp = (mailslurpService as any).mailslurp;
    const attachmentController = mailslurp.attachmentController;
    
    // Get an email with attachment
    const emails = await mailslurpService.getAllEmails({ limit: 10 });
    const emailWithAttachment = emails.find(e => e.attachments && e.attachments.length > 0);
    
    if (emailWithAttachment) {
      console.log('\nEmail with attachment:');
      console.log('Email ID:', emailWithAttachment.id);
      console.log('Subject:', emailWithAttachment.subject);
      
      // Get full email
      const fullEmail = await mailslurp.emailController.getEmail({
        emailId: emailWithAttachment.id
      });
      
      console.log('\nAttachments from full email:', fullEmail.attachments);
      
      // Try to get attachment metadata
      if (fullEmail.attachments && fullEmail.attachments.length > 0) {
        const attachmentId = fullEmail.attachments[0];
        console.log('\nTrying to get metadata for attachment ID:', attachmentId);
        
        try {
          // Try getAttachmentInfo
          const attachmentInfo = await attachmentController.getAttachmentInfo({
            attachmentId: attachmentId
          });
          console.log('\nAttachment info:', JSON.stringify(attachmentInfo, null, 2));
        } catch (error: any) {
          console.log('getAttachmentInfo failed:', error.message);
        }
        
        try {
          // Try getAttachmentMetaData
          const metadata = await attachmentController.getAttachmentMetaData({
            attachmentId: attachmentId
          });
          console.log('\nAttachment metadata:', JSON.stringify(metadata, null, 2));
        } catch (error: any) {
          console.log('getAttachmentMetaData failed:', error.message);
        }
        
        // List available methods on attachmentController
        console.log('\nAvailable attachment controller methods:');
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(attachmentController))
          .filter(name => typeof attachmentController[name] === 'function' && name !== 'constructor');
        methods.forEach(method => console.log('-', method));
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

testAttachmentMetadata();