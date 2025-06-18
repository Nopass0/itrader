#!/usr/bin/env bun

/**
 * Test script to download and parse Tinkoff PDF receipts
 * Usage: bun test-tinkoff-receipts.ts [minutes]
 * Example: bun test-tinkoff-receipts.ts 60 (search last 60 minutes)
 */

import { db } from "./src/db";
import { GmailClient } from "./src/gmail/client";
import { OAuth2Manager } from "./src/gmail/utils/oauth2";
import { EmailParser } from "./src/gmail/utils/emailParser";
import { PDFParser } from "./src/ocr/pdfParser";
import fs from "fs/promises";
import path from "path";
import type { GmailMessage, EmailAttachment } from "./src/gmail/types/models";

async function main() {
  const args = process.argv.slice(2);
  const minutes = args[0] ? parseInt(args[0]) : 30; // Default 30 minutes
  
  console.log(`\n=== Tinkoff Receipt Test ===`);
  console.log(`Searching for emails from last ${minutes} minutes\n`);
  
  try {
    // Get Gmail account
    const gmailAccount = await db.getActiveGmailAccount();
    if (!gmailAccount) {
      console.error("❌ No active Gmail account found!");
      console.log("Please set up Gmail account first using: bun run src/cli.ts");
      return;
    }
    
    console.log(`✓ Using Gmail account: ${gmailAccount.email}`);
    
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Initialize Gmail client
    const oauth2Manager = new OAuth2Manager(credentials);
    const gmailClient = new GmailClient(oauth2Manager);
    await gmailClient.setTokens({ refresh_token: gmailAccount.refreshToken });
    
    // Initialize parsers
    const emailParser = new EmailParser();
    const pdfParser = new PDFParser();
    
    // Search for Tinkoff emails
    console.log("\n📧 Searching for Tinkoff emails...");
    const after = new Date(Date.now() - minutes * 60 * 1000);
    
    const searchResult = await gmailClient.getEmailsFromSender("noreply@tinkoff.ru", {
      after,
      maxResults: 20
    });
    
    console.log(`Found ${searchResult.messages.length} emails from Tinkoff\n`);
    
    if (searchResult.messages.length === 0) {
      console.log("No emails found in the specified time range.");
      return;
    }
    
    // Create PDF directory
    const pdfDir = path.join("data", "pdf");
    await fs.mkdir(pdfDir, { recursive: true });
    
    // Process each email
    for (let i = 0; i < searchResult.messages.length; i++) {
      const email = searchResult.messages[i];
      console.log(`\n--- Email ${i + 1}/${searchResult.messages.length} ---`);
      console.log(`From: ${email.from}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Date: ${email.date.toLocaleString()}`);
      console.log(`ID: ${email.id}`);
      
      // Parse email content
      const receiptInfo = emailParser.parseReceipt(email);
      
      // Display extracted info from email text
      console.log("\n📄 Extracted from email text:");
      if (receiptInfo.amount) {
        console.log(`  Amount: ${receiptInfo.amount.toString()} RUB`);
      } else {
        console.log(`  Amount: Not found in email text`);
      }
      if (receiptInfo.transactionId) {
        console.log(`  Transaction ID: ${receiptInfo.transactionId}`);
      }
      if (receiptInfo.sender) {
        console.log(`  Sender: ${receiptInfo.sender}`);
      }
      
      // Check for PDF attachments
      if (email.attachments && email.attachments.length > 0) {
        console.log(`\n📎 Found ${email.attachments.length} attachment(s)`);
        
        for (const attachment of email.attachments) {
          if (attachment.mimeType === "application/pdf" || 
              attachment.filename.toLowerCase().endsWith(".pdf")) {
            
            console.log(`\n  Downloading PDF: ${attachment.filename}`);
            console.log(`  Size: ${(attachment.size / 1024).toFixed(2)} KB`);
            
            try {
              // Download attachment
              console.log(`  Attachment ID: ${attachment.id}`);
              const fullAttachment = await gmailClient.downloadAttachment(
                email.id,
                attachment
              );
              
              if (fullAttachment.data) {
                // Save PDF to disk
                const timestamp = email.date.toISOString().replace(/[:.]/g, '-');
                const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
                const pdfPath = path.join(pdfDir, `${timestamp}_${safeFilename}`);
                
                // Decode base64 data
                const pdfData = Buffer.from(fullAttachment.data, 'base64');
                await fs.writeFile(pdfPath, pdfData);
                
                console.log(`  ✓ Saved to: ${pdfPath}`);
                
                // Parse PDF
                console.log(`\n  🔍 Parsing PDF content...`);
                try {
                  const parsedData = await pdfParser.parseReceipt(pdfData);
                  
                  console.log(`\n  📊 Extracted from PDF:`);
                  console.log(`    Full text length: ${parsedData.text.length} characters`);
                  
                  if (parsedData.amount) {
                    console.log(`    Amount: ${parsedData.amount} RUB`);
                  }
                  if (parsedData.date) {
                    console.log(`    Date: ${parsedData.date}`);
                  }
                  if (parsedData.time) {
                    console.log(`    Time: ${parsedData.time}`);
                  }
                  if (parsedData.status) {
                    console.log(`    Status: ${parsedData.status}`);
                  }
                  if (parsedData.sender) {
                    console.log(`    Sender: ${parsedData.sender}`);
                  }
                  if (parsedData.recipient) {
                    console.log(`    Recipient: ${parsedData.recipient}`);
                  }
                  if (parsedData.recipientPhone) {
                    console.log(`    Recipient phone: ${parsedData.recipientPhone}`);
                  }
                  if (parsedData.transactionId) {
                    console.log(`    Transaction type: ${parsedData.transactionId}`);
                  }
                  if (parsedData.bankName) {
                    console.log(`    Bank: ${parsedData.bankName}`);
                  }
                  
                  // Show sample of extracted text
                  console.log(`\n    Sample text (first 500 chars):`);
                  console.log(`    "${parsedData.text.substring(0, 500).replace(/\n/g, ' ')}..."`);
                  
                } catch (pdfError) {
                  console.error(`  ❌ Failed to parse PDF:`, pdfError);
                }
              }
              
            } catch (downloadError) {
              console.error(`  ❌ Failed to download attachment:`, downloadError);
            }
          }
        }
      } else {
        console.log("\n📎 No attachments found");
      }
      
      // Add separator
      console.log("\n" + "=".repeat(60));
    }
    
    console.log(`\n✅ Test completed. PDFs saved to: ${pdfDir}`);
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    await db.disconnect();
  }
}


// Run the test
main().catch(console.error);