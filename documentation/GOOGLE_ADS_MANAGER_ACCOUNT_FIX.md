# Google Ads Manager Account Fix

## Issue
Google Ads API was returning error:
```
REQUESTED_METRICS_FOR_MANAGER: Metrics cannot be requested for a manager account. 
To retrieve metrics, issue separate requests against each client account under the manager account.
```

This error occurred for both campaign and keyword report types when trying to sync a Google Ads manager account.

## Root Cause
The Google Ads driver was attempting to request metrics directly from manager accounts. Google Ads API requires that metric requests be made to individual client accounts under a manager, not the manager account itself.

## Solution Implemented

### 1. GoogleAdsService Enhancements
Added two new methods to detect and handle manager accounts:

**`isManagerAccount(customerId, accessToken)`**
- Checks if a given customer ID is a manager account
- Queries the `customer.manager` field from Google Ads API
- Returns boolean indicating manager status

**`listClientAccounts(managerCustomerId, accessToken)`**
- Lists all enabled client accounts under a manager
- Queries the `customer_client` resource
- Filters for enabled, non-manager accounts
- Returns array of client customer IDs

### 2. GoogleAdsDriver Updates
Modified all four sync methods to handle manager accounts:

**Campaign Sync (`syncCampaignData`)**
- Detects if account is a manager
- If manager: iterates through all client accounts
- If regular: syncs directly as before
- Tracks aggregated record counts across all clients

**Keyword Sync (`syncKeywordData`)**
- Same manager account detection and iteration
- Syncs keyword data for each client account

**Geographic Sync (`syncGeographicData`)**
- Same manager account detection and iteration
- Syncs geographic data for each client account

**Device Sync (`syncDeviceData`)**
- Same manager account detection and iteration
- Syncs device data for each client account

### 3. Implementation Pattern
Each sync method now follows this pattern:
```typescript
// 1. Check if manager account
const isManager = await this.adsService.isManagerAccount(customerId, accessToken);

// 2. If manager, get client accounts and iterate
if (isManager) {
    const clientAccounts = await this.adsService.listClientAccounts(customerId, accessToken);
    for (const clientId of clientAccounts) {
        // Sync each client account
        const result = await this.sync*DataForAccount(..., clientId, ...);
        totalRecordsSynced += result.recordsSynced;
    }
    return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
}

// 3. Regular account - sync directly
return await this.sync*DataForAccount(..., customerId, ...);
```

Each sync method was split into:
- Main method: Detects manager status and coordinates syncing
- Helper method (`sync*DataForAccount`): Performs actual sync for a single account

## Files Modified

### Backend Files
1. **`backend/src/services/GoogleAdsService.ts`**
   - Added `isManagerAccount()` method
   - Added `listClientAccounts()` method

2. **`backend/src/drivers/GoogleAdsDriver.ts`**
   - Refactored `syncCampaignData()` → split into main + `syncCampaignDataForAccount()`
   - Refactored `syncKeywordData()` → split into main + `syncKeywordDataForAccount()`
   - Refactored `syncGeographicData()` → split into main + `syncGeographicDataForAccount()`
   - Refactored `syncDeviceData()` → split into main + `syncDeviceDataForAccount()`

## Testing
After deploying, test with:
1. A regular Google Ads account (should work as before)
2. A manager account with multiple clients (should sync all clients)
3. Verify separate tables are created for each client account
4. Check sync_history for proper row counts

## Expected Behavior

### Regular Account
```
🔄 Starting Google Ads sync for data source X
📊 Report types: campaign, keyword
✅ Table dra_google_ads.campaigns_ABC123 ready for account 1234567890
✅ Synced 50 campaign records for account 1234567890
```

### Manager Account
```
🔄 Starting Google Ads sync for data source X
📊 Report types: campaign, keyword
⚠️  Manager account detected (1234567890). Fetching client accounts...
📊 Syncing 3 client accounts under manager
✅ Table dra_google_ads.campaigns_DEF456 ready for account 9876543210
✅ Synced 25 campaign records for account 9876543210
✅ Table dra_google_ads.campaigns_GHI789 ready for account 5555555555
✅ Synced 30 campaign records for account 5555555555
✅ Table dra_google_ads.campaigns_JKL012 ready for account 4444444444
✅ Synced 15 campaign records for account 4444444444
✅ Google Ads sync completed
   Records: 70, Failed: 0
```

## Data Storage
- Each client account gets its own table(s) with hash-based naming
- Manager account ID stored in api_config for reference
- Individual client account IDs stored in each table's `customer_id` column
- Allows proper data isolation and querying per client

## Benefits
1. **Compliance**: Follows Google Ads API requirements for manager accounts
2. **Flexibility**: Supports both regular and manager accounts seamlessly
3. **Transparency**: Clear logging shows which accounts are being synced
4. **Data Integrity**: Separate tables per client prevent data mixing
5. **Error Handling**: Individual client failures don't block entire sync

## Future Enhancements
Consider adding:
- UI indication when account is a manager (show client count)
- Per-client sync status tracking in UI
- Option to select specific clients to sync (rather than all)
- Caching of manager status to reduce API calls

## Deployment
1. Build backend: `npm run build`
2. Restart container: `docker-compose restart backend.dataresearchanalysis.test`
3. Test with both regular and manager accounts
4. Monitor logs for proper client account detection

## Related Documentation
- Google Ads API: https://developers.google.com/google-ads/api/docs/concepts/manager-accounts
- Customer Client Resource: https://developers.google.com/google-ads/api/reference/rpc/latest/CustomerClient
