# Google Ad Manager - API Integration Guide

**Technical Reference for GAM Integration**

> **Current Implementation**: This guide documents the **simplified v1.0 API**.
>
> For complete feature status, see [`CURRENT_IMPLEMENTATION_STATUS.md`](./CURRENT_IMPLEMENTATION_STATUS.md)

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
https://your-platform.com/api/google-ad-manager
```

### Available Report Types (v1.0)

- `revenue` - Ad revenue, impressions, clicks, CPM, CTR
- `geography` - Country, region, city performance

**Not Available**: `inventory`, `orders`, `device` (planned for future)

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

**Endpoint**: `GET /api/google-ad-manager/networks`

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

**Endpoint**: `POST /api/google-ad-manager/add-data-source`

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
- `report_types`: Must be array containing only `"revenue"` and/or `"geography"`
- `sync_frequency`: Must be `"daily"`, `"weekly"`, or `"manual"`
- `start_date`, `end_date`: ISO 8601 format (YYYY-MM-DD)
- Date range is fixed to last 30 days in v1.0

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

**Endpoint**: `POST /api/google-ad-manager/sync/:dataSourceId`

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

**Endpoint**: `GET /api/google-ad-manager/sync-status/:dataSourceId`

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

**Endpoint**: `DELETE /api/google-ad-manager/:dataSourceId`

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

All GAM data is stored in the `dra_google_ad_manager` PostgreSQL schema.

### Schema Naming Convention

Tables use a special column naming convention:
```
{table_name}_{column_name}
```

Example:
- Table: `revenue_12345678`
- Column: `revenue_12345678_impressions`

This allows the AI Data Modeler to properly identify and query the data.

### Revenue Table

**Table Name**: `dra_google_ad_manager.revenue_{network_id}`

**Schema**:
```sql
CREATE TABLE dra_google_ad_manager.revenue_12345678 (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ad_unit_id VARCHAR(255),
    ad_unit_name TEXT,
    country_code VARCHAR(10),
    country_name VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(10,4) DEFAULT 0,
    fill_rate DECIMAL(10,4) DEFAULT 0,
    network_code VARCHAR(255) NOT NULL,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, ad_unit_id, country_code)
);
```

**Indexes**:
- Primary key on `id`
- Unique constraint on `(date, ad_unit_id, country_code)`
- Automatic indexing on unique constraint columns

---

### Geography Table

**Table Name**: `dra_google_ad_manager.geography_{network_id}`

**Schema**:
```sql
CREATE TABLE dra_google_ad_manager.geography_12345678 (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    country_code VARCHAR(10),
    country_name VARCHAR(255),
    region VARCHAR(255),
    city VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,
    network_code VARCHAR(255) NOT NULL,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, country_code, region, city)
);
```

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
      'https://your-platform.com/api/google-ad-manager/networks',
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
      'https://your-platform.com/api/google-ad-manager/add-data-source',
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
    url = f'https://your-platform.com/api/google-ad-manager/sync/{data_source_id}'
    
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
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ad_unit_name
ORDER BY total_revenue DESC
LIMIT 10;
```

---

## Deprecated/Removed Endpoints

The following endpoints were planned but  **not implemented** in v1.0:

❌ `GET /api/google-ad-manager/dashboard/stats`  
❌ `GET /api/google-ad-manager/dashboard/recent-syncs`  
❌ `GET /api/google-ad-manager/dashboard/health`  
❌ `GET /api/google-ad-manager/dashboard/activity`

**Reason**: Dashboard features not included. Use AI Data Modeler for custom dashboards.

---

## Support and Resources

**Documentation**:
- [Current Implementation Status](./CURRENT_IMPLEMENTATION_STATUS.md)
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
