# Bybit Payment Methods Configuration Guide

## Overview

When creating P2P advertisements on Bybit, you must use actual payment method IDs, not payment method names. This guide explains how to configure and use payment methods correctly.

## Common Error

If you see this error:
```
Request parameter error: Request parameter error. Payment IDs provided: ["Tinkoff"]. 
Note: Bybit expects payment method IDs (numeric strings), not payment method names.
```

This means you're trying to use payment method names instead of IDs.

## How to Fix

### 1. Configure Payment Methods in Bybit

First, you need to add payment methods to your Bybit P2P account:

1. Log in to your Bybit account
2. Go to P2P Trading section
3. Navigate to Payment Methods settings
4. Add your payment methods (e.g., Tinkoff bank account, SBP)
5. Make sure to name them clearly (e.g., include "Tinkoff" or "SBP" in the name)

### 2. Test Your Payment Methods

Run the test script to see your configured payment methods:

```bash
# Windows
test-bybit-payment-methods.bat

# Linux/Mac
npx ts-node test-bybit-payment-methods.ts
```

This will show you:
- All configured payment methods
- Their IDs (what Bybit expects)
- Their names (for mapping)

### 3. Payment Method Mapping

The system automatically maps payment methods based on their names:

- **Tinkoff**: Looks for "tinkoff" in the bank name or account name
- **SBP**: Looks for "sbp" or "sber" in the bank name or account name

### 4. Example Output

```
--- Account: trader1 ---
Found 2 payment method(s):

1. Tinkoff Bank - Ivan
   ID: 12345
   Type: BANK_TRANSFER
   Bank: Tinkoff
   Enabled: true

2. SBP Fast Payments
   ID: 67890
   Type: OTHER
   Enabled: true
```

In this example:
- "Tinkoff" will map to ID "12345"
- "SBP" will map to ID "67890"

## Troubleshooting

### No Payment Methods Found

If the test shows no payment methods:
1. Check that you've added payment methods in Bybit P2P settings
2. Ensure your API key has P2P permissions
3. Verify you're a verified P2P advertiser on Bybit

### Payment Method Not Mapping

If a payment method isn't being recognized:
1. Check the exact name in Bybit
2. Make sure it contains keywords like "Tinkoff", "SBP", or "Sber"
3. The mapping is case-insensitive

### Cache Issues

The system caches payment methods for 1 hour. If you've just added new payment methods:
1. Wait a few minutes for Bybit to update
2. The cache will automatically refresh after 1 hour
3. Or restart the application to force a refresh

## API Requirements

- Your Bybit API key must have P2P permissions enabled
- You must be a verified P2P advertiser
- Payment methods must be configured and verified in your account

## Security Note

Never share your API keys or payment method IDs publicly. The IDs shown in examples are fictional.