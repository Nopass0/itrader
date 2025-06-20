import { TinkoffReceiptParserV2 } from './src/ocr/receiptParserV2';
import { TinkoffReceiptParserV3 } from './src/ocr/receiptParserV3';
import { PrismaClient } from './generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

interface ComparisonResult {
  filename: string;
  v2Success: boolean;
  v3Success: boolean;
  v2Error?: string;
  v3Error?: string;
  v2Data?: any;
  v3Data?: any;
  differences?: string[];
}

async function compareField(field: string, v2Value: any, v3Value: any): Promise<string | null> {
  // Normalize values for comparison
  const normalize = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };
  
  const v2Norm = normalize(v2Value);
  const v3Norm = normalize(v3Value);
  
  if (v2Norm !== v3Norm) {
    return `${field}: V2="${v2Norm}" vs V3="${v3Norm}"`;
  }
  
  return null;
}

async function testParsers() {
  try {
    console.log('🔍 Testing Receipt Parser V3 vs V2\n');
    
    // Get all receipts from database
    const receipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${receipts.length} receipts to test\n`);
    
    const results: ComparisonResult[] = [];
    const parserV2 = new TinkoffReceiptParserV2();
    const parserV3 = new TinkoffReceiptParserV3();
    
    for (const receipt of receipts) {
      if (!receipt.filePath) continue;
      
      const fullPath = path.join(process.cwd(), receipt.filePath);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        console.log(`❌ File not found: ${receipt.filename}`);
        continue;
      }
      
      console.log(`\n📄 Testing: ${receipt.filename}`);
      
      const result: ComparisonResult = {
        filename: receipt.filename,
        v2Success: false,
        v3Success: false
      };
      
      // Test V2 parser
      try {
        const v2Data = await parserV2.parseReceiptPDF(fullPath);
        result.v2Success = true;
        result.v2Data = v2Data;
        console.log('  ✅ V2 parsed successfully');
      } catch (error: any) {
        result.v2Error = error.message;
        console.log(`  ❌ V2 error: ${error.message}`);
      }
      
      // Test V3 parser
      try {
        const v3Data = await parserV3.parseReceiptPDF(fullPath);
        result.v3Success = true;
        result.v3Data = v3Data;
        console.log('  ✅ V3 parsed successfully');
      } catch (error: any) {
        result.v3Error = error.message;
        console.log(`  ❌ V3 error: ${error.message}`);
      }
      
      // Compare results if both succeeded
      if (result.v2Success && result.v3Success) {
        const differences: string[] = [];
        const fieldsToCompare = [
          'amount', 'total', 'status', 'transferType',
          'senderName', 'senderAccount', 'recipientName',
          'recipientPhone', 'recipientBank', 'recipientCard',
          'commission', 'operationId', 'sbpCode'
        ];
        
        for (const field of fieldsToCompare) {
          const diff = await compareField(
            field,
            result.v2Data[field],
            result.v3Data[field]
          );
          if (diff) differences.push(diff);
        }
        
        if (differences.length > 0) {
          result.differences = differences;
          console.log('  ⚠️  Differences found:');
          differences.forEach(d => console.log(`     - ${d}`));
        } else {
          console.log('  ✅ Results match perfectly!');
        }
      }
      
      results.push(result);
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY\n' + '='.repeat(50));
    
    const v2SuccessCount = results.filter(r => r.v2Success).length;
    const v3SuccessCount = results.filter(r => r.v3Success).length;
    const bothSuccess = results.filter(r => r.v2Success && r.v3Success).length;
    const perfectMatches = results.filter(r => 
      r.v2Success && r.v3Success && (!r.differences || r.differences.length === 0)
    ).length;
    
    console.log(`Total receipts tested: ${results.length}`);
    console.log(`V2 success rate: ${v2SuccessCount}/${results.length} (${(v2SuccessCount/results.length*100).toFixed(1)}%)`);
    console.log(`V3 success rate: ${v3SuccessCount}/${results.length} (${(v3SuccessCount/results.length*100).toFixed(1)}%)`);
    console.log(`Both parsers succeeded: ${bothSuccess}`);
    console.log(`Perfect matches: ${perfectMatches}/${bothSuccess} (${(perfectMatches/bothSuccess*100).toFixed(1)}%)`);
    
    // Show V3 improvements
    const v3BetterThanV2 = results.filter(r => !r.v2Success && r.v3Success);
    if (v3BetterThanV2.length > 0) {
      console.log(`\n✨ V3 parsed ${v3BetterThanV2.length} receipts that V2 couldn't:`);
      v3BetterThanV2.forEach(r => console.log(`  - ${r.filename}`));
    }
    
    // Show any V3 regressions
    const v2BetterThanV3 = results.filter(r => r.v2Success && !r.v3Success);
    if (v2BetterThanV3.length > 0) {
      console.log(`\n⚠️  V2 parsed ${v2BetterThanV3.length} receipts that V3 couldn't:`);
      v2BetterThanV3.forEach(r => {
        console.log(`  - ${r.filename}: ${r.v3Error}`);
      });
    }
    
    // Detailed differences for investigation
    const withDifferences = results.filter(r => r.differences && r.differences.length > 0);
    if (withDifferences.length > 0) {
      console.log(`\n🔍 Detailed differences in ${withDifferences.length} receipts:`);
      for (const r of withDifferences) {
        console.log(`\n  ${r.filename}:`);
        r.differences!.forEach(d => console.log(`    - ${d}`));
      }
    }
    
    // Show specific improvements in V3
    console.log('\n🎯 V3 Improvements:');
    for (const r of results) {
      if (!r.v2Success || !r.v3Success) continue;
      
      // Check if V3 extracted more fields
      const v2Fields = Object.entries(r.v2Data || {})
        .filter(([k, v]) => v && v !== '' && k !== 'rawText')
        .length;
      const v3Fields = Object.entries(r.v3Data || {})
        .filter(([k, v]) => v && v !== '' && k !== 'rawText')
        .length;
      
      if (v3Fields > v2Fields) {
        console.log(`  ${r.filename}: V3 extracted ${v3Fields - v2Fields} more fields`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testParsers();