/**
 * MailSlurp Service
 * Handles email operations using MailSlurp API
 */

import { MailSlurp } from 'mailslurp-client';
import { createLogger } from '../logger';
import { db } from '../db';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

const logger = createLogger('MailSlurpService');

export interface MailSlurpConfig {
  apiKey: string;
  domain?: string;
}

export class MailSlurpService extends EventEmitter {
  private mailslurp: MailSlurp;
  private inboxController: any;
  private emailController: any;
  private attachmentController: any;
  private inbox: any | null = null;
  private inboxes: any[] = []; // All inboxes
  private apiKey: string;

  constructor(config: MailSlurpConfig) {
    super();
    this.apiKey = config.apiKey;
    this.mailslurp = new MailSlurp({ apiKey: config.apiKey });
    this.inboxController = this.mailslurp.inboxController;
    this.emailController = this.mailslurp.emailController;
    this.attachmentController = this.mailslurp.attachmentController;
  }

  /**
   * Initialize MailSlurp service and load all inboxes
   */
  async initialize(): Promise<string> {
    // Make this idempotent - if already initialized, return existing data
    if (this.inboxes.length > 0) {
      const emails = this.inboxes.map(inbox => inbox.emailAddress);
      logger.info('MailSlurp already initialized', { 
        count: this.inboxes.length,
        emails 
      });
      return emails.join(', ');
    }
    
    try {
      logger.info('Initializing MailSlurp service');
      
      // Check if API key is valid
      if (!this.apiKey || this.apiKey === 'undefined' || this.apiKey === 'stub') {
        logger.warn('Invalid or missing MAILSLURP_API_KEY, service will return empty data');
        return 'No email addresses configured';
      }

      // Load ALL existing inboxes from database
      const existingAccounts = await db.prisma.mailSlurpAccount.findMany({
        where: { isActive: true }
      });

      logger.info(`Found ${existingAccounts.length} active MailSlurp accounts in database`);

      // Verify each inbox still exists
      for (const account of existingAccounts) {
        try {
          const inbox = await this.inboxController.getInbox({ inboxId: account.inboxId });
          this.inboxes.push(inbox);
          logger.info('Verified inbox', { 
            email: inbox.emailAddress,
            inboxId: inbox.id 
          });
        } catch (error) {
          logger.warn('Inbox not found, marking as inactive', { 
            inboxId: account.inboxId,
            email: account.email 
          });
          // Mark as inactive if inbox doesn't exist
          await db.prisma.mailSlurpAccount.update({
            where: { id: account.id },
            data: { isActive: false }
          });
        }
      }

      // If no active inboxes, create a new one
      if (this.inboxes.length === 0) {
        logger.info('No active inboxes found, creating new MailSlurp inbox');
        const newInbox = await this.inboxController.createInbox({
          createInboxDto: {
            name: 'iTrader Receipt Inbox',
            description: 'Inbox for receiving Tinkoff bank receipts from noreply@tinkoff.ru',
            expiresIn: undefined // Permanent inbox
          }
        });

        logger.info('New inbox created', { 
          inboxId: newInbox.id,
          email: newInbox.emailAddress 
        });

        // Save to database
        await db.prisma.mailSlurpAccount.create({
          data: {
            email: newInbox.emailAddress!,
            inboxId: newInbox.id!,
            apiKey: this.apiKey,
            isActive: true
          }
        });

        this.inboxes.push(newInbox);
      }

      // Set the first inbox as primary for backwards compatibility
      this.inbox = this.inboxes[0];

      const emails = this.inboxes.map(inbox => inbox.emailAddress);
      logger.info('MailSlurp initialized with inboxes', { 
        count: this.inboxes.length,
        emails 
      });

      return emails.join(', ');
    } catch (error: any) {
      logger.error('Failed to initialize MailSlurp', error);
      
      // Check if it's a service unavailable error
      if (error?.status === 503 || error?.message?.includes('503')) {
        logger.error('MailSlurp API is temporarily unavailable (503 error)');
        // Don't throw - return empty state so app can continue
        return 'MailSlurp temporarily unavailable';
      }
      
      throw error;
    }
  }

  /**
   * Get all inbox email addresses
   */
  getEmailAddresses(): string[] {
    return this.inboxes.map(inbox => inbox.emailAddress);
  }

  /**
   * Get current inbox email address (for backwards compatibility)
   */
  getEmailAddress(): string {
    if (!this.inbox) {
      throw new Error('MailSlurp not initialized');
    }
    return this.inbox.emailAddress!;
  }

  /**
   * Add a new inbox
   */
  async addInbox(name?: string): Promise<string> {
    try {
      logger.info('Creating additional MailSlurp inbox');
      const newInbox = await this.inboxController.createInbox({
        createInboxDto: {
          name: name || `iTrader Receipt Inbox ${this.inboxes.length + 1}`,
          description: 'Inbox for receiving Tinkoff bank receipts from noreply@tinkoff.ru',
          expiresIn: undefined // Permanent inbox
        }
      });

      logger.info('New inbox created', { 
        inboxId: newInbox.id,
        email: newInbox.emailAddress 
      });

      // Save to database
      await db.prisma.mailSlurpAccount.create({
        data: {
          email: newInbox.emailAddress!,
          inboxId: newInbox.id!,
          apiKey: this.apiKey,
          isActive: true
        }
      });

      this.inboxes.push(newInbox);
      
      logger.info('Added new inbox', {
        email: newInbox.emailAddress,
        totalInboxes: this.inboxes.length
      });

      return newInbox.emailAddress!;
    } catch (error) {
      logger.error('Failed to add new inbox', error);
      throw error;
    }
  }

  /**
   * Check for new emails from noreply@tinkoff.ru in ALL inboxes
   */
  async checkForNewEmails(since?: Date): Promise<any[]> {
    try {
      if (this.inboxes.length === 0) {
        throw new Error('No MailSlurp inboxes initialized');
      }

      logger.info('Checking for new emails from noreply@tinkoff.ru', { 
        inboxCount: this.inboxes.length,
        since: since?.toISOString() 
      });

      const allTinkoffEmails: any[] = [];

      // Check each inbox with delay to avoid rate limits
      for (let i = 0; i < this.inboxes.length; i++) {
        const inbox = this.inboxes[i];
        
        // Add delay between inbox checks to avoid rate limit
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
        try {
          logger.debug(`Checking inbox ${inbox.emailAddress}`);
          
          // Get all emails from this inbox using paginated method
          const emails = await this.emailController.getEmailsPaginated({
            inboxId: [inbox.id!],
            page: 0,
            size: 20, // Reduced from 50 to avoid rate limits
            sort: 'DESC',
            since: since
          });

          logger.debug(`Found ${emails.content?.length || 0} total emails in ${inbox.emailAddress}`);

          // Filter for emails from noreply@tinkoff.ru
          const tinkoffEmails = (emails.content || []).filter(email => {
            // Log the 'from' field to debug
            if (email.from) {
              logger.debug('Checking email from field', {
                from: email.from,
                emailId: email.id,
                subject: email.subject
              });
            }
            
            const isFromTinkoff = email.from?.toLowerCase() === 'noreply@tinkoff.ru' || 
                                 email.from?.toLowerCase().includes('noreply@tinkoff.ru');
            
            // Process non-Tinkoff emails with attachments as bad receipts
            if (!isFromTinkoff && email.attachments && email.attachments.length > 0) {
              logger.info('Found non-Tinkoff email with attachments', {
                id: email.id,
                from: email.from,
                subject: email.subject,
                attachmentCount: email.attachments.length
              });
              
              // Process as bad receipt asynchronously
              (async () => {
                try {
                  const { getBadReceiptService } = await import('./badReceiptService');
                  const badReceiptService = getBadReceiptService();
                  
                  // Get full email details
                  const fullEmail = await this.getEmailWithAttachments(email.id);
                  
                  // Process each attachment
                  for (const attachment of email.attachments) {
                    await badReceiptService.processNonTBankReceipt(fullEmail, attachment);
                  }
                } catch (error) {
                  logger.error('Failed to process bad receipt', error, { emailId: email.id });
                }
              })();
            }
            
            if (isFromTinkoff) {
              logger.info('Found Tinkoff email', {
                id: email.id,
                from: email.from,
                subject: email.subject,
                date: email.createdAt,
                inbox: inbox.emailAddress
              });
            }
            return isFromTinkoff;
          });

          // Add inbox info to each email
          tinkoffEmails.forEach(email => {
            email.inboxId = inbox.id;
            email.inboxEmail = inbox.emailAddress;
          });

          allTinkoffEmails.push(...tinkoffEmails);
        } catch (error: any) {
          if (error.status === 429) {
            logger.warn(`Rate limit hit for inbox ${inbox.emailAddress}, will retry later`);
            // Skip remaining inboxes if rate limit hit
            break;
          } else {
            logger.error(`Failed to check inbox ${inbox.emailAddress}`, error);
          }
        }
      }

      logger.info(`Found ${allTinkoffEmails.length} total emails from noreply@tinkoff.ru across all inboxes`);
      return allTinkoffEmails;
    } catch (error) {
      logger.error('Failed to check emails', error);
      throw error;
    }
  }

  /**
   * Get email details with attachments
   */
  async getEmailWithAttachments(emailId: string): Promise<any> {
    try {
      logger.info('Getting email details', { emailId });

      const email = await this.emailController.getEmail({
        emailId: emailId
      });

      logger.info('Email retrieved', {
        emailId,
        subject: email.subject,
        from: email.from,
        attachments: email.attachments?.length || 0
      });

      return email;
    } catch (error) {
      logger.error('Failed to get email', error, { emailId });
      throw error;
    }
  }

  /**
   * Download attachment - using raw email JSON method for free plan
   */
  async downloadAttachment(emailId: string, attachmentIndex: number = 0): Promise<Buffer | null> {
    try {
      console.log(`[MailSlurp] downloadAttachment called for email ${emailId}, index ${attachmentIndex}`);
      logger.info('Attempting to download attachment via raw email method', { emailId, attachmentIndex });

      // Try direct attachment download first
      try {
        console.log(`[MailSlurp] Trying direct attachment download...`);
        const attachments = await this.emailController.getEmailAttachments({ emailId });
        
        if (attachments && attachments[attachmentIndex]) {
          const attachment = attachments[attachmentIndex];
          console.log(`[MailSlurp] Found attachment: ${attachment.name}, trying to download...`);
          
          // Try to download using attachmentController
          try {
            const attachmentData = await this.attachmentController.downloadAttachmentAsBase64Encoded({
              emailId,
              attachmentId: attachment.attachmentId
            });
            
            if (attachmentData && attachmentData.base64FileContents) {
              console.log(`[MailSlurp] Successfully downloaded attachment via attachmentController`);
              return Buffer.from(attachmentData.base64FileContents, 'base64');
            }
          } catch (error) {
            console.log(`[MailSlurp] Direct download failed:`, error);
          }
        }
      } catch (error) {
        console.log(`[MailSlurp] Failed to get attachments list:`, error);
      }

      // Fallback to raw email JSON method
      try {
        console.log(`[MailSlurp] Falling back to raw email JSON method...`);
        logger.info('Getting raw email JSON...');
        const rawEmailJson = await this.emailController.getRawEmailJson({
          emailId: emailId
        });
        
        if (rawEmailJson && rawEmailJson.content) {
          logger.info('Raw email retrieved successfully', { size: rawEmailJson.content.length });
          
          // Extract attachments from raw email content
          const attachments = this.extractAttachmentsFromEml(rawEmailJson.content);
          
          if (attachments.length > attachmentIndex) {
            logger.info('Successfully extracted attachment from raw email', {
              attachmentCount: attachments.length,
              attachmentSize: attachments[attachmentIndex].length
            });
            return attachments[attachmentIndex];
          } else {
            logger.warn('No attachment found at index', { 
              requestedIndex: attachmentIndex, 
              totalAttachments: attachments.length 
            });
          }
        }
      } catch (error) {
        logger.error('Raw email method failed', error);
      }

      return null;
    } catch (error) {
      logger.error('Failed to download attachment', error, { emailId });
      return null;
    }
  }

  /**
   * Extract attachments from raw email content
   */
  private extractAttachmentsFromEml(rawEmailContent: string): Buffer[] {
    const attachments: Buffer[] = [];
    
    try {
      // Find boundary in the raw email
      const boundaryMatch = rawEmailContent.match(/boundary="?([^"\n\r]+)"?/);
      if (!boundaryMatch) {
        logger.warn('No boundary found in raw email');
        return attachments;
      }
      
      const boundary = boundaryMatch[1];
      logger.debug('Found boundary', { boundary });
      
      // Split by boundary
      const parts = rawEmailContent.split(`--${boundary}`);
      
      logger.debug('Email parts found', { count: parts.length });
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Check if this part is a PDF attachment
        const isPdfAttachment = part.includes('Content-Type: application/pdf') || 
                               (part.includes('Content-Disposition: attachment') && 
                                (part.includes('filename=') && part.toLowerCase().includes('.pdf')));
        
        if (isPdfAttachment) {
          logger.debug('Found PDF attachment in part', { partIndex: i });
          
          // Look for base64 content after Content-Transfer-Encoding: base64
          const base64Index = part.indexOf('Content-Transfer-Encoding: base64');
          if (base64Index !== -1) {
            // Find the start of base64 content (after double newline)
            const contentStart = part.indexOf('\r\n\r\n', base64Index);
            if (contentStart !== -1) {
              // Extract base64 content until the next boundary or end
              const base64Content = part.substring(contentStart + 4).trim();
              
              // Clean up the base64 content (remove any trailing boundary markers)
              const cleanBase64 = base64Content.split('\r\n--')[0].replace(/\r?\n/g, '');
              
              if (cleanBase64.length > 0) {
                try {
                  const buffer = Buffer.from(cleanBase64, 'base64');
                  logger.info('Successfully extracted PDF', { size: buffer.length });
                  attachments.push(buffer);
                } catch (err) {
                  logger.error('Failed to decode base64', err);
                }
              }
            }
          }
        }
      }
      
      logger.info('Attachment extraction complete', { totalAttachments: attachments.length });
    } catch (error) {
      logger.error('Failed to extract attachments from EML', error);
    }
    
    return attachments;
  }

  /**
   * Process Tinkoff receipts and match with payouts
   */
  async processReceipts(since?: Date): Promise<void> {
    try {
      console.log('[MailSlurp] Starting receipt processing', {
        since: since?.toISOString(),
        inboxCount: this.inboxes.length
      });
      
      logger.info('Starting receipt processing', {
        since: since?.toISOString(),
        inboxCount: this.inboxes.length,
        inboxEmails: this.inboxes.map(i => i.emailAddress)
      });

      const emails = await this.checkForNewEmails(since);
      
      // Log all found emails for debugging
      logger.info(`[MailSlurp] checkForNewEmails returned ${emails.length} emails`);
      emails.forEach((email, idx) => {
        logger.debug(`Email ${idx + 1}:`, {
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.createdAt,
          hasAttachments: email.hasAttachments
        });
      });
      
      console.log(`[MailSlurp] Found ${emails.length} emails from noreply@tinkoff.ru`);
      
      if (emails.length === 0) {
        logger.debug('No new emails to process');
        return;
      }

      for (const emailSummary of emails) {
        try {
          console.log(`[MailSlurp] Processing email ${emailSummary.id} - ${emailSummary.subject}`);
          
          // Check if already processed
          const existingReceipt = await db.prisma.receipt.findUnique({
            where: { emailId: emailSummary.id! }
          });

          if (existingReceipt) {
            console.log(`[MailSlurp] Email ${emailSummary.id} already processed`);
            logger.debug('Email already processed', { emailId: emailSummary.id });
            continue;
          }

          console.log(`[MailSlurp] Email ${emailSummary.id} is new, processing...`);
          
          logger.info('Processing new email', {
            emailId: emailSummary.id,
            subject: emailSummary.subject,
            from: emailSummary.from,
            hasAttachments: emailSummary.hasAttachments
          });

          // Get full email
          console.log(`[MailSlurp] Getting full email details for ${emailSummary.id}`);
          const email = await this.getEmailWithAttachments(emailSummary.id!);
          
          // Always get attachments metadata separately as email.attachments might just be IDs
          let attachmentMetadata: any[] = [];
          try {
            logger.info('Getting attachments metadata...');
            attachmentMetadata = await this.emailController.getEmailAttachments({
              emailId: emailSummary.id!
            });
            logger.info(`Got ${attachmentMetadata.length} attachment metadata`);
          } catch (error) {
            logger.warn('Failed to get attachment metadata', error);
          }

          // Process PDF attachments
          console.log(`[MailSlurp] Email ${emailSummary.id} has ${attachmentMetadata?.length || 0} attachments`);
          
          if (attachmentMetadata && attachmentMetadata.length > 0) {
            console.log(`[MailSlurp] Processing ${attachmentMetadata.length} attachments for email ${emailSummary.id}`);
            logger.info(`Processing ${attachmentMetadata.length} attachments`);
            
            let attachmentIndex = 0;
            for (const attachment of attachmentMetadata) {
              const isPdf = attachment.contentType === 'application/pdf' || 
                           attachment.name?.toLowerCase().endsWith('.pdf');
                           
              logger.info('Checking attachment', {
                name: attachment.name,
                contentType: attachment.contentType,
                isPdf,
                index: attachmentIndex
              });

              if (isPdf) {
                console.log(`[MailSlurp] Found PDF attachment: ${attachment.name}`);
                logger.info('Found PDF attachment', {
                  filename: attachment.name,
                  size: attachment.size,
                  index: attachmentIndex
                });

                // Download attachment using the new EML method
                console.log(`[MailSlurp] Downloading PDF attachment ${attachment.name} for email ${email.id}`);
                logger.info('Downloading PDF attachment via EML method', {
                  emailId: email.id,
                  attachmentIndex
                });
                
                let buffer: Buffer | null = null;
                
                // Log attachment info
                console.log(`[MailSlurp] Attachment info:`, {
                  name: attachment.name,
                  attachmentId: attachment.attachmentId,
                  id: attachment.id,
                  contentType: attachment.contentType,
                  size: attachment.size
                });
                
                // Try direct download with attachment ID with timeout
                const attachmentIdToUse = attachment.attachmentId || attachment.id;
                if (attachmentIdToUse) {
                  try {
                    console.log(`[MailSlurp] Trying direct download with attachmentId: ${attachmentIdToUse}`);
                    
                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) => {
                      setTimeout(() => reject(new Error('Download timeout')), 10000); // 10 second timeout
                    });
                    
                    // Race between download and timeout
                    const attachmentData = await Promise.race([
                      this.attachmentController.downloadAttachmentAsBase64Encoded({
                        emailId: email.id!,
                        attachmentId: attachmentIdToUse
                      }),
                      timeoutPromise
                    ]) as any;
                    
                    if (attachmentData && attachmentData.base64FileContents) {
                      console.log(`[MailSlurp] Direct download successful`);
                      buffer = Buffer.from(attachmentData.base64FileContents, 'base64');
                    }
                  } catch (error: any) {
                    console.log(`[MailSlurp] Direct download failed:`, error.message || error);
                  }
                }
                
                // Skip fallback for now since it hangs
                // if (!buffer) {
                //   buffer = await this.downloadAttachment(email.id!, attachmentIndex);
                // }
                
                if (!buffer) {
                  console.log(`[MailSlurp] Failed to download attachment ${attachment.name}`);
                  logger.error('Failed to download attachment', {
                    emailId: email.id,
                    name: attachment.name,
                    index: attachmentIndex
                  });
                  attachmentIndex++;
                  continue;
                }
                
                console.log(`[MailSlurp] Successfully downloaded PDF, size: ${buffer.length} bytes`);
                
                // Ensure receipts directory exists
                const receiptsDir = path.join(process.cwd(), 'data', 'receipts');
                if (!fs.existsSync(receiptsDir)) {
                  fs.mkdirSync(receiptsDir, { recursive: true });
                  logger.info('Created receipts directory', { path: receiptsDir });
                }

                // Generate unique filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const filename = `receipt_${timestamp}_${attachment.name || 'receipt.pdf'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
                const filepath = path.join(receiptsDir, filename);
                
                // Save PDF file
                fs.writeFileSync(filepath, buffer);
                logger.info('✅ Receipt PDF saved successfully', { 
                  filepath, 
                  size: buffer.length,
                  filename 
                });

                // Create initial receipt record in database
                const relativePath = path.join('data', 'receipts', filename);
                const receipt = await db.prisma.receipt.create({
                  data: {
                    emailId: email.id!,
                    filename: filename,
                    filePath: relativePath,  // Save relative path
                    emailFrom: email.from || '',
                    emailSubject: email.subject || '',
                    receivedAt: new Date(email.createdAt || Date.now()),
                    isProcessed: false,
                    parsedData: {},
                    rawEmailData: email as any
                  }
                });

                logger.info('Receipt record created in database', { 
                  receiptId: receipt.id,
                  filename 
                });

                // Parse the receipt PDF using OCR
                try {
                  logger.info('Starting OCR processing for receipt', { filepath });
                  
                  const { TinkoffReceiptParser } = await import('../ocr');
                  const parser = new TinkoffReceiptParser();
                  const parsedData = await parser.parseReceiptPDF(filepath);
                  
                  logger.info('✅ Receipt OCR completed successfully', {
                    amount: parsedData.amount,
                    senderName: parsedData.senderName,
                    recipientName: parsedData.recipientName,
                    recipientCard: parsedData.recipientCard
                  });

                  // Update receipt with parsed OCR data
                  await db.prisma.receipt.update({
                    where: { id: receipt.id },
                    data: {
                      amount: parsedData.amount,
                      senderName: parsedData.senderName,
                      recipientName: parsedData.recipientName,
                      recipientCard: parsedData.recipientCard,
                      transactionDate: parsedData.transactionDate ? new Date(parsedData.transactionDate) : undefined,
                      parsedData: parsedData as any,
                      rawText: parsedData.rawText
                    }
                  });

                  logger.info('Receipt updated with OCR data', { receiptId: receipt.id });

                  // Try to match with payout
                  const { ReceiptMatcher } = await import('./receiptMatcher');
                  const matcher = new ReceiptMatcher();
                  
                  const updatedReceipt = await db.prisma.receipt.findUnique({
                    where: { id: receipt.id }
                  });

                  if (updatedReceipt && updatedReceipt.amount) {
                    const matchResult = await matcher.matchReceiptToTransaction(updatedReceipt);
                    
                    if (matchResult.success && matchResult.transactionId) {
                      logger.info('✅ Receipt matched to transaction!', {
                        receiptId: receipt.id,
                        transactionId: matchResult.transactionId,
                        payoutId: matchResult.payoutId,
                        confidence: matchResult.confidence
                      });

                      // Update receipt as processed
                      await db.prisma.receipt.update({
                        where: { id: receipt.id },
                        data: { 
                          isProcessed: true,
                          payoutId: matchResult.payoutId
                        }
                      });

                      // Auto-approve transaction with receipt
                      try {
                        logger.info('🚀 Auto-approving transaction with receipt', {
                          transactionId: matchResult.transactionId,
                          payoutId: matchResult.payoutId,
                          receiptPath: filepath
                        });

                        // Use AssetReleaseService for approval
                        const { getAssetReleaseService } = await import('./assetReleaseService');
                        const assetReleaseService = getAssetReleaseService();
                        
                        const approved = await assetReleaseService.approveTransactionWithReceipt(
                          matchResult.transactionId,
                          matchResult.payoutId!,
                          filepath
                        );

                        if (approved) {
                          logger.info('✅ Transaction auto-approved and completed!', {
                            transactionId: matchResult.transactionId
                          });
                        } else {
                          logger.warn('Failed to auto-approve transaction', {
                            transactionId: matchResult.transactionId
                          });
                        }
                      } catch (approveError) {
                        logger.error('Failed to auto-approve transaction', approveError, {
                          transactionId: matchResult.transactionId
                        });
                      }

                      // Emit event for transaction completion
                      this.emit('receipt:matched', {
                        receipt: updatedReceipt,
                        transactionId: matchResult.transactionId,
                        payoutId: matchResult.payoutId
                      });
                      
                      console.log(`[MailSlurp] ✅ Receipt processed and matched: ${filename}`);
                    } else {
                      logger.info('No matching transaction found for receipt', {
                        receiptId: receipt.id,
                        amount: updatedReceipt.amount
                      });
                      console.log(`[MailSlurp] ⚠️ Receipt processed but no match found: ${filename}`);
                    }
                  }
                } catch (parseError) {
                  logger.error('Failed to parse/match receipt', parseError, {
                    receiptId: receipt.id,
                    filepath
                  });
                  console.error(`[MailSlurp] ❌ Failed to process receipt: ${filename}`, parseError);
                }

                // Emit event for real-time updates
                this.emit('receipt:new', receipt);
              }
              
              attachmentIndex++;
            }
          } else {
            logger.info('No attachments in email', { emailId: email.id });
          }
        } catch (error) {
          logger.error('Failed to process email', error, { emailId: emailSummary.id });
        }
      }

      logger.info('Receipt processing completed', {
        processed: emails.length
      });
    } catch (error) {
      logger.error('Failed to process receipts', error);
      throw error;
    }
  }

  /**
   * Monitor inbox for new emails (webhook alternative)
   */
  async startMonitoring(intervalMs: number = 60000): Promise<any> {
    const emails = this.inboxes.map(inbox => inbox.emailAddress);
    logger.info('Starting email monitoring', { 
      intervalMs,
      inboxCount: this.inboxes.length,
      inboxEmails: emails 
    });
    
    let lastCheck: Date | undefined;

    const checkEmails = async () => {
      try {
        console.log('[MailSlurp] Checking for new emails...', {
          lastCheck: lastCheck?.toISOString(),
          inboxCount: this.inboxes.length
        });
        
        logger.debug('Checking for new emails...', {
          lastCheck: lastCheck?.toISOString(),
          inboxEmail: this.inbox?.emailAddress
        });
        
        // First run - check all emails, then only new ones
        await this.processReceipts(lastCheck);
        lastCheck = new Date();
      } catch (error) {
        console.error('[MailSlurp] Error in email monitoring:', error);
        logger.error('Error in email monitoring', error);
      }
    };

    // Initial check - process all existing emails
    logger.info('Running initial email check...');
    await checkEmails();

    // Set up interval for future checks
    const intervalId = setInterval(checkEmails, intervalMs);
    logger.info(`Email monitoring scheduled every ${intervalMs/1000} seconds`);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Process email attachments to get full metadata
   */
  private async processAttachments(email: any): Promise<any[]> {
    if (!email.attachments || email.attachments.length === 0) {
      return [];
    }
    
    const processedAttachments = [];
    
    for (const att of email.attachments) {
      try {
        // If att is just a string (attachment ID), fetch metadata
        if (typeof att === 'string') {
          try {
            const attachmentInfo = await this.attachmentController.getAttachmentInfo({
              attachmentId: att
            });
            
            processedAttachments.push({
              id: attachmentInfo.id || att,
              name: attachmentInfo.name || 'attachment',
              contentType: attachmentInfo.contentType || 'application/octet-stream',
              size: attachmentInfo.contentLength || 0
            });
          } catch (error) {
            logger.warn('Failed to get attachment info', { attachmentId: att, error });
            processedAttachments.push({
              id: att,
              name: 'attachment',
              contentType: 'application/octet-stream',
              size: 0
            });
          }
        } else {
          // If att is already an object, map the fields
          processedAttachments.push({
            id: att?.attachmentId || att?.id || '',
            name: att?.name || '',
            contentType: att?.contentType || '',
            size: att?.size || att?.contentLength || 0
          });
        }
      } catch (e) {
        logger.error('Error processing attachment', e, { attachment: att });
      }
    }
    
    return processedAttachments;
  }

  /**
   * Get all emails from all inboxes
   */
  async getAllEmails(params: {
    limit?: number;
    search?: string;
    inboxId?: string;
  } = {}): Promise<any[]> {
    try {
      const allEmails = [];
      
      // Ensure service is initialized
      if (!this.inboxes || this.inboxes.length === 0) {
        logger.info('No inboxes available, attempting to initialize...');
        try {
          await this.initialize();
        } catch (initError: any) {
          logger.error('Failed to initialize MailSlurp service', initError);
          
          // Check if it's a service unavailable error
          if (initError?.status === 503 || initError?.message?.includes('503')) {
            logger.warn('MailSlurp API is temporarily unavailable, returning empty email list');
          }
          
          // Return empty array instead of throwing to prevent frontend errors
          return [];
        }
      }
      
      const inboxesToCheck = params.inboxId 
        ? this.inboxes.filter(inbox => inbox.id === params.inboxId)
        : this.inboxes;

      logger.info(`Getting emails from ${inboxesToCheck.length} inboxes`, {
        ...params,
        inboxCount: inboxesToCheck.length,
        inboxIds: inboxesToCheck.map(i => i.id)
      });

      // If no inboxes, return empty array
      if (inboxesToCheck.length === 0) {
        logger.warn('No inboxes found to check for emails');
        return [];
      }

      // Try to get all emails at once first
      try {
        logger.info('Attempting to get all emails from all inboxes at once...');
        const allEmailsResponse = await this.emailController.getEmailsPaginated({
          page: 0,
          size: params.limit || 200,
          sort: 'DESC',
          unreadOnly: false
        });

        if (allEmailsResponse && (Array.isArray(allEmailsResponse) || allEmailsResponse.content)) {
          const emailList = Array.isArray(allEmailsResponse) ? allEmailsResponse : (allEmailsResponse.content || []);
          
          logger.info(`Got ${emailList.length} emails from getAllEmails API`);
          
          // Process and return these emails
          for (const email of emailList) {
            allEmails.push({
              id: email.id,
              subject: email.subject || 'Без темы',
              from: email.from || 'Неизвестный отправитель',
              to: email.to || [],
              body: email.body || email.bodyHTML || email.bodyPlainText || email.textContent || '',
              bodyExcerpt: email.bodyExcerpt || ((email.body || email.bodyHTML || email.bodyPlainText || email.textContent) ? (email.body || email.bodyHTML || email.bodyPlainText || email.textContent).substring(0, 150) + '...' : ''),
              createdAt: email.createdAt,
              read: email.read || false,
              attachments: await this.processAttachments(email) || [],
              inboxId: email.inboxId || inboxesToCheck[0]?.id,
              emailAddress: email.recipients?.[0] || email.to?.[0] || inboxesToCheck[0]?.emailAddress
            });
          }

          // Apply filters and return
          let filteredEmails = allEmails;
          if (params.search) {
            const searchQuery = params.search.toLowerCase();
            filteredEmails = allEmails.filter(email =>
              email.subject.toLowerCase().includes(searchQuery) ||
              email.from.toLowerCase().includes(searchQuery) ||
              email.body.toLowerCase().includes(searchQuery) ||
              email.emailAddress.toLowerCase().includes(searchQuery)
            );
          }

          filteredEmails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          if (params.limit) {
            filteredEmails = filteredEmails.slice(0, params.limit);
          }

          logger.info(`Returning ${filteredEmails.length} emails after filtering`);
          return filteredEmails;
        }
      } catch (error) {
        logger.warn('Failed to get all emails at once, falling back to per-inbox method', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
      }

      for (const inbox of inboxesToCheck) {
        try {
          logger.debug(`Fetching emails from inbox ${inbox.id} (${inbox.emailAddress})`);
          
          // First get email list
          const emailsPromise = this.emailController.getInboxEmailsPaginated({
            inboxId: inbox.id,
            page: 0,
            size: params.limit || 100,
            sort: 'DESC'
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout fetching emails from inbox ${inbox.id}`)), 15000)
          );
          
          const emailsResponse = await Promise.race([emailsPromise, timeoutPromise]) as any;
          
          logger.info(`Got email response from inbox ${inbox.id}`, {
            hasContent: !!emailsResponse?.content,
            contentLength: emailsResponse?.content?.length || 0,
            totalElements: emailsResponse?.totalElements,
            responseKeys: emailsResponse ? Object.keys(emailsResponse) : []
          });

          // Check if emails is an array directly (not paginated)
          const emailList = Array.isArray(emailsResponse) ? emailsResponse : (emailsResponse?.content || []);
          
          if (!emailList || !Array.isArray(emailList)) {
            logger.warn(`No email content from inbox ${inbox.id}`, {
              response: emailsResponse,
              responseType: typeof emailsResponse
            });
            continue;
          }
          
          // Now fetch full details for each email
          const processedEmails = [];
          for (const emailSummary of emailList) {
            try {
              // Get full email with body
              const fullEmail = await this.emailController.getEmail({ emailId: emailSummary.id });
              
              processedEmails.push({
                id: fullEmail.id,
                subject: fullEmail.subject || 'Без темы',
                from: fullEmail.from || 'Неизвестный отправитель',
                to: fullEmail.to || [],
                body: fullEmail.body || fullEmail.bodyHTML || fullEmail.bodyPlainText || fullEmail.textContent || '',
                bodyExcerpt: fullEmail.bodyExcerpt || ((fullEmail.body || fullEmail.bodyHTML || fullEmail.bodyPlainText || fullEmail.textContent) ? (fullEmail.body || fullEmail.bodyHTML || fullEmail.bodyPlainText || fullEmail.textContent).substring(0, 150) + '...' : ''),
                createdAt: fullEmail.createdAt,
                read: fullEmail.read || false,
                attachments: fullEmail.attachments?.map(att => {
                  try {
                    return {
                      id: att?.attachmentId || att?.id || '',
                      name: att?.name || '',
                      contentType: att?.contentType || '',
                      size: att?.size || 0
                    };
                  } catch (e) {
                    logger.error('Error processing attachment in email details', e, { attachment: att });
                    return {
                      id: '',
                      name: '',
                      contentType: '',
                      size: 0
                    };
                  }
                }) || [],
                inboxId: inbox.id,
                emailAddress: inbox.emailAddress
              });
            } catch (detailError) {
              logger.warn(`Failed to get full details for email ${emailSummary.id}`, detailError);
              // Still include basic info if we can't get full details
              processedEmails.push({
                id: emailSummary.id,
                subject: emailSummary.subject || 'Без темы',
                from: emailSummary.from || 'Неизвестный отправитель',
                to: emailSummary.to || [],
                body: '',
                bodyExcerpt: '',
                createdAt: emailSummary.createdAt,
                read: emailSummary.read || false,
                attachments: [],
                inboxId: inbox.id,
                emailAddress: inbox.emailAddress
              });
            }
          }

          allEmails.push(...processedEmails);
        } catch (error) {
          logger.error(`Error getting emails from inbox ${inbox.id}`, error as Error);
        }
      }

      // Apply search filter
      let filteredEmails = allEmails;
      if (params.search) {
        const searchQuery = params.search.toLowerCase();
        filteredEmails = allEmails.filter(email =>
          email.subject.toLowerCase().includes(searchQuery) ||
          email.from.toLowerCase().includes(searchQuery) ||
          email.body.toLowerCase().includes(searchQuery) ||
          email.emailAddress.toLowerCase().includes(searchQuery)
        );
      }

      // Sort by creation date (newest first)
      filteredEmails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply limit
      if (params.limit) {
        filteredEmails = filteredEmails.slice(0, params.limit);
      }

      logger.info(`Retrieved ${filteredEmails.length} emails from ${inboxesToCheck.length} inboxes`);
      return filteredEmails;

    } catch (error) {
      logger.error('Error getting all emails', error as Error);
      throw error;
    }
  }

  /**
   * Get specific email details
   */
  async getEmail(inboxId: string, emailId: string): Promise<any> {
    try {
      logger.info(`Getting email details for ${emailId} in inbox ${inboxId}`);
      const email = await this.emailController.getEmail({ emailId });
      
      logger.debug('Email response structure', {
        hasBody: !!email.body,
        hasRawEmail: !!email.rawEmail,
        hasBodyHTML: !!email.bodyHTML,
        hasBodyPlainText: !!email.bodyPlainText,
        hasTextContent: !!email.textContent,
        bodyLength: email.body?.length || 0,
        keys: Object.keys(email).filter(k => k.toLowerCase().includes('body') || k.toLowerCase().includes('content'))
      });
      
      // Get attachment metadata separately if needed
      if (email.attachments && email.attachments.length > 0) {
        try {
          const attachmentMetadata = await this.emailController.getEmailAttachments({ emailId });
          if (attachmentMetadata && attachmentMetadata.length > 0) {
            logger.debug('Got attachment metadata', { count: attachmentMetadata.length });
            // Merge metadata with existing attachments
            email.attachments = email.attachments.map((att, index) => {
              const metadata = attachmentMetadata[index] || attachmentMetadata.find(m => m.id === att.id || m.attachmentId === att.attachmentId);
              if (metadata) {
                return { ...att, ...metadata };
              }
              return att;
            });
          }
        } catch (error) {
          logger.warn('Failed to get attachment metadata', error);
        }
      }
      
      // Try different body fields
      let body = email.body || email.bodyHTML || email.bodyPlainText || email.textContent || '';
      if (!body && email.rawEmail) {
        body = email.rawEmail;
      }
      
      return {
        id: email.id,
        subject: email.subject || 'Без темы',
        from: email.from || 'Неизвестный отправитель',
        to: email.to || [],
        body: body,
        bodyExcerpt: email.bodyExcerpt || (body ? body.substring(0, 150) + '...' : ''),
        createdAt: email.createdAt,
        read: email.read || false,
        attachments: await this.processAttachments(email) || [],
        inboxId: inboxId,
        rawEmail: email.rawEmail
      };
    } catch (error) {
      logger.error(`Error getting email ${emailId}`, error as Error);
      throw error;
    }
  }

  /**
   * Download attachment with improved method
   */
  async downloadAttachment(emailId: string, attachmentId: string): Promise<{
    downloadUrl: string;
    fileName: string;
    contentType: string;
    size: number;
  }> {
    try {
      logger.info(`Downloading attachment ${attachmentId} from email ${emailId}`);
      
      // Get email details first to find attachment info
      const email = await this.emailController.getEmail({ emailId });
      
      logger.debug('Email attachments info', {
        attachmentCount: email.attachments?.length || 0,
        attachments: email.attachments?.map(att => ({
          id: att.id,
          attachmentId: att.attachmentId,
          name: att.name,
          contentType: att.contentType,
          size: att.size
        }))
      });
      
      const attachment = email.attachments?.find(att => 
        (att.attachmentId === attachmentId) || (att.id === attachmentId)
      );
      
      if (!attachment) {
        logger.error('Attachment not found', { attachmentId, availableIds: email.attachments?.map(a => ({ id: a.id, attachmentId: a.attachmentId })) });
        throw new Error('Attachment not found');
      }

      // Get attachment binary data using the correct ID
      const attachmentIdToUse = attachment.attachmentId || attachment.id || attachmentId;
      logger.debug(`Using attachment ID: ${attachmentIdToUse}`);
      
      let attachmentData;
      try {
        attachmentData = await this.attachmentController.downloadAttachmentAsBase64Encoded({
          emailId,
          attachmentId: attachmentIdToUse
        });
      } catch (error) {
        logger.error('Failed to download attachment data', { error, emailId, attachmentIdToUse });
        
        // Try alternative method - get attachment as bytes
        try {
          logger.info('Trying alternative download method...');
          const attachmentBytes = await this.attachmentController.downloadAttachmentAsBytes({
            emailId,
            attachmentId: attachmentIdToUse
          });
          
          // Convert bytes to base64
          const base64Content = Buffer.from(attachmentBytes).toString('base64');
          attachmentData = { base64FileContents: base64Content };
        } catch (altError) {
          logger.error('Alternative download method also failed', altError);
          throw new Error('Failed to download attachment using all available methods');
        }
      }

      if (!attachmentData || !attachmentData.base64FileContents) {
        throw new Error('No attachment data received');
      }

      // Convert base64 to data URL
      const downloadUrl = `data:${attachment.contentType || 'application/octet-stream'};base64,${attachmentData.base64FileContents}`;

      return {
        downloadUrl,
        fileName: attachment.name || 'attachment',
        contentType: attachment.contentType || 'application/octet-stream',
        size: attachment.size || attachment.contentLength || attachment.length || attachmentData.base64FileContents.length || 0
      };
    } catch (error) {
      logger.error(`Error downloading attachment ${attachmentId} from email ${emailId}`, error as Error);
      throw error;
    }
  }

  /**
   * Mark email as read
   */
  async markEmailAsRead(inboxId: string, emailId: string): Promise<void> {
    try {
      await this.emailController.markAsRead({ emailId, read: true });
      logger.info(`Marked email ${emailId} as read`);
    } catch (error) {
      logger.error(`Error marking email ${emailId} as read`, error as Error);
      throw error;
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(): Promise<{
    totalEmails: number;
    readEmails: number;
    unreadEmails: number;
    emailsWithAttachments: number;
    totalInboxes: number;
  }> {
    try {
      const allEmails = await this.getAllEmails({ limit: 1000 });
      
      const totalEmails = allEmails.length;
      const readEmails = allEmails.filter(email => email.read).length;
      const unreadEmails = totalEmails - readEmails;
      const emailsWithAttachments = allEmails.filter(email => email.attachments.length > 0).length;
      const totalInboxes = this.inboxes.length;

      return {
        totalEmails,
        readEmails,
        unreadEmails,
        emailsWithAttachments,
        totalInboxes
      };
    } catch (error) {
      logger.error('Error getting email stats', error as Error);
      throw error;
    }
  }

  /**
   * Get list of inboxes
   */
  getInboxes(): any[] {
    return this.inboxes.map(inbox => ({
      id: inbox.id,
      emailAddress: inbox.emailAddress,
      name: inbox.name,
      description: inbox.description,
      createdAt: inbox.createdAt,
      inboxType: inbox.inboxType
    }));
  }

  /**
   * Send a test email to an inbox (for debugging)
   */
  async sendTestEmail(toInboxId?: string): Promise<void> {
    try {
      const targetInbox = toInboxId 
        ? this.inboxes.find(i => i.id === toInboxId) 
        : this.inboxes[0];
        
      if (!targetInbox) {
        throw new Error('No inbox found to send test email to');
      }

      // Use the correct method from MailSlurp SDK
      const sentEmail = await this.mailslurp.inboxController.sendEmailAndConfirm({
        inboxId: targetInbox.id,
        sendEmailOptions: {
          to: [targetInbox.emailAddress],
          subject: 'Test Email - ' + new Date().toISOString(),
          body: 'This is a test email sent from iTrader application.',
          isHTML: false
        }
      });

      logger.info('Test email sent', {
        to: targetInbox.emailAddress,
        inboxId: targetInbox.id
      });
    } catch (error) {
      logger.error('Failed to send test email', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
let mailslurpService: MailSlurpService | null = null;
let initializationPromise: Promise<MailSlurpService> | null = null;

export async function getMailSlurpService(): Promise<MailSlurpService> {
  if (mailslurpService) {
    return mailslurpService;
  }

  // If already initializing, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    const apiKey = process.env.MAILSLURP_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      logger.warn('MAILSLURP_API_KEY not configured, creating stub service');
      // Create a stub service that returns empty data
      const service = new MailSlurpService({ apiKey: 'stub' });
      mailslurpService = service;
      return service;
    }

    const service = new MailSlurpService({ apiKey });
    mailslurpService = service;
    
    // Initialize the service here if called from email controller
    // The app.ts will also call initialize, but it's idempotent
    try {
      await service.initialize();
    } catch (error) {
      console.error('[MailSlurpService] Failed to initialize:', error);
      // Don't throw - let app.ts handle initialization
    }
    
    return service;
  })();

  return initializationPromise;
}

// Synchronous getter for already initialized service
export function getMailSlurpServiceSync(): MailSlurpService | null {
  return mailslurpService;
}