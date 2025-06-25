# Prisma JSON Field Query Fix for SQLite

## Problem

Prisma 6.9.0 with SQLite throws the error:
```
Argument `path`: Invalid value provided. Expected String, provided (String).
```

This occurs when trying to use JSON path queries like:
```typescript
// This DOESN'T work with SQLite
where: {
  amountTrader: {
    path: ["643"],
    equals: receipt.amount
  }
}
```

## Root Cause

SQLite has limited support for JSON path queries in Prisma. The `path` operator with JSON fields is primarily supported in PostgreSQL and MySQL, but not fully in SQLite.

## Solution

Instead of using JSON path queries, fetch the data and filter in application code:

### Before (Broken):
```typescript
const payout = await prisma.payout.findFirst({
  where: {
    OR: [
      { amount: receipt.amount },
      {
        amountTrader: {
          path: ["643"],
          equals: receipt.amount,
        },
      },
    ],
  },
});
```

### After (Fixed):
```typescript
// Fetch payouts without JSON path filtering
const payouts = await prisma.payout.findMany({
  where: {
    // Use other filters to reduce dataset
    createdAt: { gte: startDate, lte: endDate },
    // etc.
  },
});

// Filter by JSON fields in application code
const matchingPayout = payouts.find(payout => {
  if (payout.amount === receipt.amount) {
    return true;
  }
  // Check JSON field
  if (payout.amountTrader && typeof payout.amountTrader === 'object') {
    const amountTrader = payout.amountTrader as any;
    return amountTrader['643'] === receipt.amount;
  }
  return false;
});
```

## Implementation Pattern

1. **Use regular field queries** where possible to reduce the dataset
2. **Fetch data** without JSON path filtering
3. **Filter JSON fields** in application code
4. **Type cast** JSON fields appropriately

## Files Updated

- `/src/services/receiptPayoutLinkerService.ts` - All JSON path queries replaced with application-level filtering

## Alternative Solutions

1. **Migrate to PostgreSQL or MySQL** - These databases have full JSON path query support
2. **Use raw SQL queries** - SQLite's `json_extract()` function can be used via `prisma.$queryRaw`
3. **Store frequently queried JSON values in separate columns** - Denormalize for better query performance

## Testing

Run the test script to verify JSON queries work correctly:
```bash
bun run test_scripts/test-json-queries.ts
```