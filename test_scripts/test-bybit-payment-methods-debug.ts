import { BybitP2PClient } from './src/bybit/p2pClient';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

async function testPaymentMethods() {
  console.log('=== Bybit Payment Methods Debug Test ===\n');

  // Test accounts
  const accounts = [
    {
      name: 'Bybit Account 1',
      apiKey: process.env.BYBIT_API_KEY_1,
      apiSecret: process.env.BYBIT_API_SECRET_1,
    },
    {
      name: 'Bybit Account 2',
      apiKey: process.env.BYBIT_API_KEY_2,
      apiSecret: process.env.BYBIT_API_SECRET_2,
    },
    {
      name: 'Bybit Account 3',
      apiKey: process.env.BYBIT_API_KEY_3,
      apiSecret: process.env.BYBIT_API_SECRET_3,
    }
  ];

  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'data', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `payment-methods-debug-${timestamp}.json`);
  const allResults: any[] = [];

  for (const account of accounts) {
    if (!account.apiKey || !account.apiSecret) {
      console.log(`⚠️  Skipping ${account.name} - No credentials configured\n`);
      continue;
    }

    console.log(`\n📊 Testing ${account.name}`);
    console.log('─'.repeat(50));

    try {
      const client = new BybitP2PClient(account.apiKey, account.apiSecret);
      
      console.log('Fetching payment methods...');
      const response = await client.getPaymentMethods();
      
      // Store full response
      const accountResult = {
        account: account.name,
        timestamp: new Date().toISOString(),
        fullResponse: response,
        paymentMethods: []
      };

      console.log(`\n✅ Raw response received`);
      console.log(`Response type: ${typeof response}`);
      console.log(`Response is array: ${Array.isArray(response)}`);
      
      if (response && typeof response === 'object') {
        console.log(`Response keys: ${Object.keys(response).join(', ')}`);
      }

      // Log first few characters of stringified response
      const responseStr = JSON.stringify(response, null, 2);
      console.log(`\nFirst 500 chars of response:\n${responseStr.substring(0, 500)}...`);

      // Try to extract payment methods
      let paymentMethods = [];
      
      // Check different possible structures
      if (Array.isArray(response)) {
        paymentMethods = response;
        console.log(`\n📋 Response is directly an array with ${paymentMethods.length} items`);
      } else if (response?.result && Array.isArray(response.result)) {
        paymentMethods = response.result;
        console.log(`\n📋 Found payment methods in response.result: ${paymentMethods.length} items`);
      } else if (response?.data && Array.isArray(response.data)) {
        paymentMethods = response.data;
        console.log(`\n📋 Found payment methods in response.data: ${paymentMethods.length} items`);
      } else if (response?.paymentMethods && Array.isArray(response.paymentMethods)) {
        paymentMethods = response.paymentMethods;
        console.log(`\n📋 Found payment methods in response.paymentMethods: ${paymentMethods.length} items`);
      }

      if (paymentMethods.length > 0) {
        console.log('\n🔍 Analyzing payment method structure:');
        console.log('─'.repeat(50));
        
        // Analyze first payment method in detail
        const firstMethod = paymentMethods[0];
        console.log('\nFirst payment method structure:');
        console.log(JSON.stringify(firstMethod, null, 2));
        
        console.log('\n📊 Payment method fields analysis:');
        console.log(`Top-level keys: ${Object.keys(firstMethod).join(', ')}`);
        
        // Check for nested objects
        for (const key of Object.keys(firstMethod)) {
          const value = firstMethod[key];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            console.log(`\n  ${key} (object) keys: ${Object.keys(value).join(', ')}`);
            
            // Log nested values if they might contain names
            for (const nestedKey of Object.keys(value)) {
              if (nestedKey.toLowerCase().includes('name') || 
                  nestedKey.toLowerCase().includes('title') ||
                  nestedKey.toLowerCase().includes('label')) {
                console.log(`    ${nestedKey}: ${value[nestedKey]}`);
              }
            }
          }
        }

        // Process all payment methods
        console.log('\n📃 All payment methods summary:');
        console.log('─'.repeat(50));
        
        paymentMethods.forEach((method, index) => {
          const methodInfo: any = {
            index,
            id: method.id || method.paymentId || method.paymentMethodId || 'N/A',
            possibleNames: {}
          };

          // Look for name in various possible locations
          const nameFields = [
            'paymentName',
            'name',
            'paymentMethodName',
            'methodName',
            'displayName',
            'title',
            'label'
          ];

          // Check top level
          for (const field of nameFields) {
            if (method[field]) {
              methodInfo.possibleNames[`method.${field}`] = method[field];
            }
          }

          // Check nested objects
          const nestedObjects = ['paymentConfigVo', 'paymentConfig', 'config', 'paymentMethod', 'method'];
          for (const objName of nestedObjects) {
            if (method[objName] && typeof method[objName] === 'object') {
              for (const field of nameFields) {
                if (method[objName][field]) {
                  methodInfo.possibleNames[`method.${objName}.${field}`] = method[objName][field];
                }
              }
            }
          }

          // Also check for type/bank info
          methodInfo.type = method.paymentType || method.type || method.paymentMethodType || 'N/A';
          methodInfo.bankName = method.bankName || method.bank || 'N/A';
          methodInfo.accountNo = method.accountNo || method.accountNumber || 'N/A';
          
          // Store full method for reference
          methodInfo.fullData = method;
          
          accountResult.paymentMethods.push(methodInfo);
          
          console.log(`\nMethod ${index + 1}:`);
          console.log(`  ID: ${methodInfo.id}`);
          console.log(`  Type: ${methodInfo.type}`);
          console.log(`  Bank: ${methodInfo.bankName}`);
          console.log(`  Possible name fields found:`);
          
          if (Object.keys(methodInfo.possibleNames).length === 0) {
            console.log(`    ❌ No name fields found!`);
          } else {
            for (const [path, value] of Object.entries(methodInfo.possibleNames)) {
              console.log(`    ✅ ${path}: "${value}"`);
            }
          }
        });
      } else {
        console.log('\n❌ No payment methods found in response');
      }

      allResults.push(accountResult);

    } catch (error) {
      console.error(`\n❌ Error for ${account.name}:`, error);
      allResults.push({
        account: account.name,
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Save detailed results to file
  console.log(`\n\n💾 Saving detailed results to: ${logFile}`);
  fs.writeFileSync(logFile, JSON.stringify(allResults, null, 2));
  
  console.log('\n=== Summary ===');
  console.log('─'.repeat(50));
  console.log('✅ Test completed. Check the log file for full details.');
  console.log('\nKey findings:');
  
  // Analyze common patterns
  const allPossiblePaths = new Set<string>();
  for (const result of allResults) {
    if (result.paymentMethods) {
      for (const method of result.paymentMethods) {
        Object.keys(method.possibleNames || {}).forEach(path => allPossiblePaths.add(path));
      }
    }
  }
  
  if (allPossiblePaths.size > 0) {
    console.log('\n🔍 All possible name field paths found:');
    Array.from(allPossiblePaths).sort().forEach(path => {
      console.log(`  - ${path}`);
    });
  } else {
    console.log('\n❌ No name fields found in any payment methods!');
    console.log('   The API might be returning data in a different format.');
    console.log('   Check the log file for the complete response structure.');
  }
}

// Run the test
testPaymentMethods().catch(console.error);