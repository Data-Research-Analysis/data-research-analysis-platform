# Google Ad Manager - API Integration Guide

**Technical Reference for GAM Integration**

> **Last reviewed:** 2026-10-22. The driver implements **6 report types** (`revenue`, `geography`, `device`, `ad_unit`, `advertiser`, `time_series`); the UI/`/report-types` endpoint advertises 5 (`revenue`, `inventory`, `orders`, `geography`, `device`). `inventory`/`orders` currently fall back to the revenue query. See [GAM_REPORT_TYPES_REFERENCE.md](GAM_REPORT_TYPES_REFERENCE.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Database Schema](#database-schema)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Code Examples](#code-examples)

---

## Overview

The Google Ad Manager integration provides RESTful API endpoints for:
- OAuth 2.0 authentication
- Network listing and selection
- Data source configuration
- Data synchronization
- Sync status monitoring

### Base URL

```
http://backend.dataresearchanalysis.test:3002/google-ad-manager
```

### Report types

Implemented in the driver:

- `revenue` — ad revenue, impressions, clicks, CPM, CTR, fill rate
- `geography` — country/region/city performance
- `device` — device category, browser, OS
- `ad_unit` — ad unit performance with ad-server/fill metrics
- `advertiser` — advertiser/order/line-item delivery
- `time_series` — daily network totals

Advertised by the UI/`GET /report-types`: `revenue`, `inventory`, `orders`, `geography`, `device`. `inventory` and `orders` are not separate schemas and currently run the revenue query.

---

## Authentication

### OAuth 2.0 Flow

The integration uses Google OAuth 2.0 for authentication.

#### Required Scope

```
https://www.googleapis.com/auth/dfp
```

#### OAuth Flow Steps

1. **Initiate OAuth**:
   - Frontend redirects to Google OAuth consent screen
   - User grants permissions
   - Google redirects back with authorization code

2. **Exchange Code for Tokens**:
   - Backend exchanges code for access + refresh tokens
   - Tokens encrypted and stored server-side
   - Access token used for GAM API calls

3. **Token Refresh**:
   - Access tokens expire after 1 hour
   - Refresh tokens used to obtain new access tokens
   - Automatic refresh handled by backend

#### Security

- ✅ Tokens stored encrypted in database (backend only)
- ✅ Never exposed to frontend/client
- ✅ Automatic refresh before expiration
- ✅ Secure HTTPS communication only

---

## API Endpoints

### 1. List Networks

Get list of GAM networks accessible to authenticated user.

**Endpoint**: `GET /google-ad-manager/networks`

**Headers**:
```http
Authorization: Bearer {your_jwt_token}
```

**Query Parameters**:
```
access_token (required): Google OAuth access token
```

**Response** (200 OK):
```json
{
  "success": true,
  "networks": [
    {
      "networkCode": "12345678",
      "networkName": "My Publisher Network",
      "displayName": "Publisher Network Prod",
      "timeZone": "America/New_York"
    }
  ]
}
```

**Error Response** (401):
```json
{
  "success": false,
  "error": "Invalid or expired access token"
}
```

---

### 2. Add Data Source

Create new GAM data source connection.

**Endpoint**: `POST /google-ad-manager/add-data-source`

**Headers**:
```http
Authorization: Bearer {your_jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Production Network Revenue",
  "network_code": "12345678",
  "report_types": ["revenue", "geography"],
  "start_date": "2024-11-17",
  "end_date": "2024-12-17",
  "sync_frequency": "daily",
  "access_token": "ya29.a0...",
  "refresh_token": "1//0...",
  "token_expiry": "2024-12-18T10:00:00Z",
  "project_id": 123
}
```

**Field Validation**:
- `report_types`: Array of one or more report-type ids (see above)
- `sync_frequency`: `"hourly"`, `"daily"`, `"weekly"`, or `"manual"`
- `start_date`, `end_date`: optional ISO 8601 dates; default is the last 30 days

**Response** (200 OK):
```json
{
  "success": true,
  "data_source_id": 42,
  "message": "Data source created successfully"
}
```

**Error Responses**:

400 Bad Request:
```json
{
  "success": false,
  "error": "Invalid report type. Only 'revenue' and 'geography' are supported."
}
```

401 Unauthorized:
```json
{
  "success": false,
  "error": "Authentication required"
}
```

---

### 3. Trigger Manual Sync

Manually trigger data synchronization.

**Endpoint**: `POST /google-ad-manager/sync/:dataSourceId`

**Headers**:
```http
Authorization: Bearer {your_jwt_token}
```

**URL Parameters**:
- `dataSourceId` (required): Data source ID

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Sync started",
  "sync_id": 456
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Data source not found"
}
```

---

### 4. Get Sync Status

Retrieve synchronization status and history.

**Endpoint**: `GET /google-ad-manager/sync-status/:dataSourceId`

**Headers**:
```http
Authorization: Bearer {your_jwt_token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "dataSourceId": 42,
  "lastSync": {
    "id": 456,
    "startedAt": "2024-12-17T02:00:00Z",
    "completedAt": "2024-12-17T02:04:32Z",
    "status": "COMPLETED",
    "recordsSynced": 1250,
    "recordsFailed": 0,
    "error": null
  },
  "history": [
    {
      "id": 455,
      "startedAt": "2024-12-16T02:00:00Z",
      "completedAt": "2024-12-16T02:03:15Z",
      "status": "COMPLETED",
      "recordsSynced": 1180
    }
  ]
}
```

**Status Values**:
- `PENDING`: Waiting to start
- `RUNNING`: Sync in progress
- `COMPLETED`: Finished successfully
- `FAILED`: Encountered errors
- `PARTIAL`: Some reports failed

---

### 5. Delete Data Source

Remove data source connection.

**Endpoint**: `DELETE /google-ad-manager/:dataSourceId`

**Headers**:
```http
Authorization: Bearer {your_jwt_token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Data source deleted successfully"
}
```

---

## Database Schema

All GAM data is stored in the `dra_google_ad_manager` PostgreSQL schema. Physical table names are generated per data source **and network** by `TableMetadataService.generatePhysicalTableName()`:

```
dra_google_ad_manager."ds{dataSourceId}_{md5[:8]}"
```

The logical report type (`revenue`, `geography`, `device`, `ad_unit`, `advertiser`, `time_series`) is stored in `dra_table_metadata`. Each table carries `network_code` and `synced_at`; revenue/geography/device/ad-unit/advertiser tables have their own unique keys.

See [GAM_REPORT_TYPES_REFERENCE.md](GAM_REPORT_TYPES_REFERENCE.md) for the full column list, unique constraints, and sample queries. Do not rely on the older `{report_type}_{network_id}` naming.

---

## Error Handling

### Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | No authentication token provided |
| `AUTH_INVALID` | 401 | Invalid or expired token |
| `INVALID_NETWORK` | 400 | Network code not found or invalid |
| `INVALID_REPORT_TYPE` | 400 | Unsupported report type |
| `RATE_LIMIT` | 429 | Too many requests |
| `GAM_API_ERROR` | 502 | Google Ad Manager API error |
| `DATABASE_ERROR` | 500 | Internal database error |

### Retry Logic

The backend automatically retries failed API calls:
- **Attempts**: 3
- **Strategy**: Exponential backoff
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds

---

## Rate Limiting

### Platform Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/networks` | 10 requests | 1 minute |
| `/add-data-source` | 5 requests | 1 minute |
| `/sync/:id` | 3 requests | 1 minute |
| `/sync-status/:id` | 20 requests | 1 minute |

### Google Ad Manager API Limits

Google imposes its own rate limits:
- **Default**: 10 requests/second
- **Daily Quota**: Varies by account

**Best Practices**:
- Use scheduled daily sync instead of frequent manual syncs
- Avoid polling sync-status endpoint too frequently
- Implement exponential backoff on failures

---

## Code Examples

### JavaScript/Node.js - List Networks

```javascript
const axios = require('axios');

async function listGAMNetworks(accessToken, jwtToken) {
  try {
    const response = await axios.get(
      'http://backend.dataresearchanalysis.test:3002/google-ad-manager/networks',
      {
        params: { access_token: accessToken },
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      }
    );
    
    return response.data.networks;
  } catch (error) {
    console.error('Failed to list networks:', error.response.data);
    throw error;
  }
}
```

---

### JavaScript/Node.js - Add Data Source

```javascript
async function addGAMDataSource(config, jwtToken) {
  try {
    const response = await axios.post(
      'http://backend.dataresearchanalysis.test:3002/google-ad-manager/add-data-source',
      {
        name: config.name,
        network_code: config.networkCode,
        report_types: ['revenue', 'geography'],
        start_date: '2024-11-17',
        end_date: '2024-12-17',
        sync_frequency: 'daily',
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
        token_expiry: config.tokenExpiry,
        project_id: config.projectId
      },
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data_source_id;
  } catch (error) {
    console.error('Failed to add data source:', error.response.data);
    throw error;
  }
}
```

---

### Python - Trigger Sync

```python
import requests

def trigger_gam_sync(data_source_id, jwt_token):
    url = f'http://backend.dataresearchanalysis.test:3002/google-ad-manager/sync/{data_source_id}'
    
    headers = {
        'Authorization': f'Bearer {jwt_token}'
    }
    
    response = requests.post(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Sync started: {data['sync_id']}")
        return data['sync_id']
    else:
        error = response.json()
        print(f"Sync failed: {error['error']}")
        return None
```

---

### SQL - Query Revenue Data

```sql
-- Top ad units by revenue
SELECT 
  ad_unit_name,
  SUM(revenue) as total_revenue,
  SUM(impressions) as total_impressions,
  ROUND(AVG(cpm), 2) as avg_cpm
FROM dra_google_ad_manager."ds42_ab12cd34"
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ad_unit_name
ORDER BY total_revenue DESC
LIMIT 10;
```

---

## Deprecated/Removed Endpoints

The following dashboard endpoints are not implemented:

❌ `GET /google-ad-manager/dashboard/stats`  
❌ `GET /google-ad-manager/dashboard/recent-syncs`  
❌ `GET /google-ad-manager/dashboard/health`  
❌ `GET /google-ad-manager/dashboard/activity`

**Reason**: Dashboard features not included. Use AI Data Modeler for custom dashboards.

---

## Support and Resources

**Documentation**:
- [User Guide](./GAM_USER_GUIDE.md)
- [Report Types Reference](./GAM_REPORT_TYPES_REFERENCE.md)
- [Troubleshooting Guide](./GAM_TROUBLESHOOTING_GUIDE.md)

**API Support**:
- Technical Documentation: This guide
- Email: api-support@dataresearchanalysis.com
- Developer Forum: https://developers.dataresearchanalysis.com

---

**Document Version**: 2.0 (Updated for Simplified Release)  
**Last Updated**: December 17, 2025  
**Status**: Current Implementation
