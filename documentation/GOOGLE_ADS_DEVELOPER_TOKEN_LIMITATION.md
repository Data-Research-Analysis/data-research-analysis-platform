# Google Ads Developer Token Limitation

## Current Issue

The Google Ads sync is failing with the following error:

```json
{
  "error": {
    "code": 403,
    "message": "The caller does not have permission",
    "status": "PERMISSION_DENIED",
    "details": [
      {
        "@type": "type.googleapis.com/google.ads.googleads.v22.errors.GoogleAdsFailure",
        "errors": [
          {
            "errorCode": {
              "authorizationError": "DEVELOPER_TOKEN_NOT_APPROVED"
            },
            "message": "The developer token is only approved for use with test accounts. To access non-test accounts, apply for Basic or Standard access."
          }
        ]
      }
    ]
  }
}
```

## Root Cause

Google Ads API developer tokens have different access levels:

1. **Test Access** (Current): Only works with test accounts
2. **Basic Access**: Works with production accounts, limited to 15,000 operations/day
3. **Standard Access**: Works with production accounts, higher limits

Our current developer token is only approved for **Test Access**, which means it can only query test accounts that are explicitly linked to the developer token's MCC (My Client Center) account.

## Production Account Restrictions

When trying to sync production Google Ads accounts (manager or client accounts), the API returns `DEVELOPER_TOKEN_NOT_APPROVED` because:

- The accounts are not test accounts
- The developer token doesn't have Basic or Standard access approval

## Solution Options

### Option 1: Apply for Basic Access (Recommended)

**Steps:**
1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Click on your developer token
3. Click "Apply for Basic Access"
4. Fill out the application form:
   - Describe your use case
   - Explain how you'll use the API
   - Provide screenshots of your integration
5. Wait for Google's approval (can take several days to weeks)

**Requirements:**
- Active Google Ads account with billing enabled
- At least $50 spent in the last 90 days
- No policy violations
- Clear business use case

### Option 2: Use Test Accounts (Temporary)

**Steps:**
1. Create a test manager account in Google Ads
2. Link the test account to your MCC
3. Create test campaigns and data
4. Use the test account for development and testing

**Limitations:**
- No real production data
- Cannot sync actual client accounts
- Only for development/testing purposes

### Option 3: Apply for Standard Access (For High Volume)

If you need more than 15,000 operations per day:
1. First get Basic Access approved
2. Use the API consistently for a period
3. Apply for Standard Access upgrade

## Current Implementation Status

✅ **Manager Account Support**: Complete
- Automatic manager detection
- Client account listing
- Multi-client sync iteration
- Frontend UI for client selection
- Correct `login-customer-id` header handling

❌ **Production Account Access**: Blocked by developer token limitation

## Testing with Test Accounts

To test the implementation with test accounts:

1. **Create Test Manager Account:**
   - Go to Google Ads
   - Create a test account
   - Link it to your MCC

2. **Create Test Client Accounts:**
   - Under the test manager, create test clients
   - Add test campaigns with sample data

3. **Connect in Application:**
   - Use OAuth to authenticate
   - Select the test manager account
   - Choose a test client account
   - Run sync (should work with test accounts)

## API Documentation References

- [Google Ads API Access Levels](https://developers.google.com/google-ads/api/docs/access-levels)
- [Apply for Basic Access](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
- [Test Account Guidelines](https://developers.google.com/google-ads/api/docs/best-practices/test-accounts)

## Next Steps

1. **Immediate**: Apply for Basic Access (if you want to use production accounts)
2. **Alternative**: Create test accounts for development/testing
3. **Monitor**: Check application status regularly
4. **Prepare**: Document your use case and prepare screenshots for the application

## Technical Implementation Complete

Despite the developer token limitation, the technical implementation for manager account support is complete:

- ✅ Backend manager detection
- ✅ Client account listing
- ✅ Multi-client sync iteration
- ✅ Frontend UI for account selection
- ✅ Correct API header handling (`login-customer-id`)
- ✅ Type definitions updated
- ✅ Data flow from frontend → backend → API

Once the developer token is approved for Basic or Standard access, the sync will work seamlessly with production accounts.
