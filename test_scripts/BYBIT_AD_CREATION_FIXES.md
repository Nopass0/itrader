# Bybit Advertisement Creation Fixes

## Issues Fixed

### 1. Response Structure Handling
**Problem**: Bybit's create advertisement API returns only minimal data:
```json
{
  "itemId": "1932049640693727232",
  "securityRiskToken": "",
  "riskTokenType": "",
  "riskVersion": "",
  "needSecurityRisk": false
}
```

**Solution**: 
- Updated `createAdvertisement` methods to return `any` type instead of expecting full `P2PAdvertisement`
- Extract `itemId` from response using `createResponse.itemId || createResponse.id`
- Store the advertisement parameters we sent since they're not in the response
- Save to database using the parameters we sent, not expecting them from response

### 2. Database Save with Correct Values
**Problem**: Code was trying to access `ad.id`, `ad.price`, etc. which don't exist in response

**Solution**:
- Store advertisement parameters before sending to API
- Use stored parameters when saving to database
- Use the `itemId` from response as `bybitAdId`
- Set status as "ONLINE" by default after creation

### 3. Maximum 2 Ads Per Account Check
**Problem**: Need to prevent creating more than 2 ads per account

**Solution**:
- Added `getActiveAdCountFromBybit()` method to check actual count from Bybit API
- Check both database count and Bybit API count, use the maximum
- Throw clear error message if account already has 2 ads

### 4. Price Within 5% Error Prevention
**Problem**: Bybit requires new ad prices to differ by at least 5% from existing ads

**Solution**:
- Added price conflict check before creating advertisement
- Calculate price difference percentage with existing ads
- Throw error with clear message showing the price difference if < 5%

## Updated Files

1. **src/services/bybitP2PManager.ts**
   - Fixed `createAdvertisementWithAutoAccount` method
   - Added price conflict checking
   - Added `getActiveAdCountFromBybit` method
   - Store ad parameters and use them for database save

2. **src/bybit/p2pClient.ts**
   - Changed `createAdvertisement` return type to `any`
   - Added comment about response structure

3. **src/bybit/p2pManager.ts**
   - Changed `createAdvertisement` return type to `any`
   - Added `getAdvertisementDetails` method

## Testing

Created test scripts:
- `test-bybit-ad-creation.ts` - Test advertisement creation flow
- `test-bybit-ad-creation.bat` - Windows batch file to run the test

## Usage Example

```typescript
const manager = new BybitP2PManagerService();
await manager.initialize();

try {
  const result = await manager.createAdvertisementWithAutoAccount(
    payoutId,
    "1000",     // amount in RUB
    "RUB",      // currency
    "SBP"       // payment method
  );
  
  console.log("Created ad:", result.advertisementId);
} catch (error) {
  // Handle errors like max ads reached or price conflict
  console.error(error.message);
}
```

## Important Notes

1. Always check ad count before creating new ones
2. Ensure price differs by at least 5% from existing ads
3. The API response doesn't include full ad details - we store what we sent
4. Payment methods must be configured in Bybit account first