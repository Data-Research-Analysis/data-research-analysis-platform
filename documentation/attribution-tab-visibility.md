# Attribution Tab Conditional Visibility

## Overview
The Marketing Attribution tab is now conditionally displayed based on whether the data model contains columns suitable for attribution tracking. This prevents confusion when users work with data models that don't contain behavioral/event data.

## Implementation Location
- **File**: `/frontend/pages/projects/[projectid]/data-sources/[datasourceid]/data-models/[datamodelid]/edit.vue`
- **Computed Property**: `isAttributionCompatible`
- **Tooltip Property**: `attributionTooltipMessage`

## Compatibility Requirements

### Required Columns (MUST have both)

#### 1. User Identifier Column
Attribution needs to track actions by individual users/customers/visitors.

**Accepted patterns** (case-insensitive substring match):
- `user_id`, `userid`
- `customer_id`, `customerid`
- `email`
- `session_id`, `sessionid`
- `visitor_id`, `visitorid`
- `account_id`

**Examples**:
- ✅ `user_id` matches
- ✅ `customer_email` matches (contains "email")
- ✅ `visitor_session_id` matches (contains "session_id")
- ❌ `product_id` does NOT match
- ❌ `name` does NOT match

#### 2. Timestamp Column
Attribution requires time-based analysis of user journeys.

**Accepted patterns** (case-insensitive substring match):
- `created_at`, `createdat`
- `timestamp`
- `date`
- `event_date`
- `event_time`
- `occurred_at`
- `time`
- `datetime`

**Examples**:
- ✅ `created_at` matches
- ✅ `event_timestamp` matches (contains "timestamp")
- ✅ `purchase_date` matches (contains "date")
- ❌ `expiration` does NOT match
- ❌ `duration` does NOT match

### Recommended Columns (Need at least ONE)

#### 3. Event Type Column (Recommended)
Identifies what action occurred.

**Accepted patterns**:
- `event`
- `action`
- `activity`
- `conversion`
- `type`

**Examples**:
- ✅ `event_name` matches
- ✅ `conversion_type` matches
- ✅ `user_action` matches

#### 4. Channel/Source Column (Recommended)
Identifies where the user came from (marketing channel).

**Accepted patterns**:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `channel`
- `source`
- `referrer`
- `medium`

**Examples**:
- ✅ `utm_source` matches
- ✅ `traffic_channel` matches
- ✅ `referrer_url` matches

## Logic Flow

### Compatibility Check
```typescript
isAttributionCompatible = computed(() => {
    // Extract column names
    const columns = data_model.query.columns.map(col => 
        (col.alias || col.column_name).toLowerCase()
    );

    // Check requirements
    hasUserIdentifier = columns match ANY user identifier pattern
    hasTimestamp = columns match ANY timestamp pattern
    hasEventType = columns match ANY event pattern
    hasChannel = columns match ANY channel pattern

    // Must have BOTH required + at least ONE recommended
    return hasUserIdentifier && hasTimestamp && (hasEventType || hasChannel);
});
```

### User Experience

#### When Compatible
- ✅ Attribution tab button is clickable and visible
- User can access full attribution tracking features
- No restrictions

#### When NOT Compatible
- 🔒 Attribution tab button is grayed out with lock icon
- Tooltip on hover explains what's missing
- Attempting to access tab redirects to Builder tab
- Clear messaging: "Attribution tracking requires: user identifier (user_id, customer_id, email, etc.) and timestamp (created_at, date, timestamp, etc.)"

## Example Data Models

### ✅ Compatible: E-commerce Events
```
Columns:
- user_id          (✅ user identifier)
- event_timestamp  (✅ timestamp)
- event_name       (✅ event type)
- utm_source       (✅ channel)
- order_value

Result: Attribution tab VISIBLE
```

### ✅ Compatible: Website Analytics
```
Columns:
- session_id       (✅ user identifier)
- page_view_date   (✅ timestamp)
- referrer         (✅ channel)
- page_url

Result: Attribution tab VISIBLE
```

### ❌ NOT Compatible: Product Catalog
```
Columns:
- product_id       (❌ not a user identifier)
- product_name
- price
- category
- created_at       (✅ timestamp, but missing user identifier)

Result: Attribution tab HIDDEN
Reason: Missing user identifier column
```

### ❌ NOT Compatible: Customer Database (Static)
```
Columns:
- customer_id      (✅ user identifier)
- customer_name
- email
- company_name
- registration_date (✅ timestamp)

Result: Attribution tab HIDDEN
Reason: Missing event type or channel columns (static data, not event data)
```

### ❌ NOT Compatible: Inventory
```
Columns:
- sku
- product_name
- quantity
- warehouse_location
- last_updated     (✅ timestamp, but missing user identifier)

Result: Attribution tab HIDDEN
Reason: Missing user identifier column
```

## Technical Details

### Column Name Extraction
The logic checks both `alias` (user-defined column name) and `column_name` (original database column name):

```typescript
const columns = data_model.query.columns.map((col: any) => 
    (col.alias || col.column_name || '').toLowerCase()
);
```

This ensures that custom column aliases (e.g., "Customer Email" aliasing `email_address`) are properly recognized.

### Matching Strategy
- **Case-insensitive**: `USER_ID`, `user_id`, `User_Id` all match
- **Substring matching**: `customer_email_address` matches because it contains "email"
- **Multiple patterns**: If ANY pattern matches, the requirement is satisfied

### Watcher for Tab Protection
A Vue watcher prevents direct navigation to the attribution tab when incompatible:

```typescript
watch([activeTab, isAttributionCompatible], ([newTab, compatible]) => {
    if (newTab === 'attribution' && !compatible) {
        activeTab.value = 'builder'; // Redirect to safe tab
    }
});
```

This handles:
- Browser back/forward navigation
- Direct URL access
- Programmatic tab changes

## Customization

### Adding New Column Patterns
To recognize additional column naming patterns, edit the pattern arrays in `isAttributionCompatible`:

```typescript
// Add new patterns to existing arrays
const userIdentifierPatterns = [
    'user_id', 'userid', 'customer_id', 'customerid', 'email',
    'YOUR_NEW_PATTERN_HERE' // Add here
];
```

### Changing Requirements
To make attribution available for different column combinations, modify the return statement:

```typescript
// Current: Requires user identifier + timestamp + (event OR channel)
return hasUserIdentifier && hasTimestamp && (hasEventType || hasChannel);

// Alternative: Only require user identifier + timestamp
return hasUserIdentifier && hasTimestamp;

// Alternative: Require ALL three
return hasUserIdentifier && hasTimestamp && hasEventType;
```

## Related Files
- **UI Component**: `/frontend/pages/projects/[projectid]/data-sources/[datasourceid]/data-models/[datamodelid]/edit.vue`
- **Attribution Panel**: `/frontend/components/AttributionPanel.vue`
- **Data Model Entity**: `/backend/src/models/DRADataModel.ts`
- **Implementation Plan**: `/documentation/marketing-attribution-implementation-analysis.md`

## Testing Recommendations

### Manual Testing Checklist
1. ✅ Create data model with user_id + timestamp + event → Attribution tab visible
2. ✅ Create data model with only product data → Attribution tab hidden with tooltip
3. ✅ Hover over locked tab → Tooltip shows missing requirements
4. ✅ Try accessing attribution via URL when incompatible → Redirects to builder
5. ✅ Edit data model to add required columns → Attribution tab becomes visible
6. ✅ Test with various column name variations (customer_id, USER_EMAIL, etc.)

### Future Automated Tests
Consider adding Vitest tests for `isAttributionCompatible` logic:
- Test pattern matching (case-insensitive, substring)
- Test requirement combinations
- Test tooltip messages
- Test watcher behavior

## Future Enhancements

### Potential Improvements
1. **Smart Suggestions**: When tab is hidden, suggest which columns to add
2. **Column Mapping**: Let users manually map columns to attribution fields
3. **Partial Compatibility**: Show tab with warnings if only some requirements met
4. **Data Preview**: Show sample data to help users understand if model is suitable
5. **AI Detection**: Use AI to analyze column values and suggest attribution suitability

### Backend Integration
Consider adding backend validation:
- API endpoint to check attribution compatibility
- Include compatibility flag in data model response
- Track which models use attribution features

## Changelog
- **2024-01-XX**: Initial implementation of conditional attribution tab visibility
- Pattern-based column name matching (user identifier, timestamp, event, channel)
- Tooltip with clear explanation of missing requirements
- Automatic tab redirect for incompatible models
