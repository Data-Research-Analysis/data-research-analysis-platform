# Google Analytics API Integration Guide

**Developer Guide for GA4 Integration**

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Code Examples](#code-examples)
8. [Integration Patterns](#integration-patterns)
9. [Best Practices](#best-practices)

---

## Overview

The Data Research Analysis platform provides a RESTful API for Google Analytics 4 integration. This guide covers authentication, endpoints, request/response formats, and code examples for developers building custom integrations.

### Base URL

```
https://your-domain.com/api/google-analytics
```

### API Version

Current Version: **1.0**

### Supported Operations

- List accessible GA4 properties
- Retrieve metadata (dimensions/metrics)
- Get predefined report presets
- Create GA4 data source connections
- Trigger data synchronization
- Monitor sync status and history

### Prerequisites

- Valid JWT authentication token
- Google OAuth 2.0 credentials with `analytics.readonly` scope
- Access to at least one GA4 property

---

## Authentication

### JWT Authentication

All API requests require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Google OAuth 2.0

GA4 API operations require Google OAuth tokens with the `https://www.googleapis.com/auth/analytics.readonly` scope.

**OAuth Flow:**

1. **Initiate OAuth:**
   ```javascript
   // Redirect user to Google OAuth consent screen
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
     `client_id=${CLIENT_ID}&` +
     `redirect_uri=${REDIRECT_URI}&` +
     `response_type=code&` +
     `scope=https://www.googleapis.com/auth/analytics.readonly&` +
     `access_type=offline&` +
     `prompt=consent`;
   
   window.location.href = authUrl;
   ```

2. **Exchange Authorization Code:**
   ```javascript
   const response = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       code: authorizationCode,
       client_id: CLIENT_ID,
       client_secret: CLIENT_SECRET,
       redirect_uri: REDIRECT_URI,
       grant_type: 'authorization_code'
     })
   });
   
   const { access_token, refresh_token } = await response.json();
   ```

3. **Use Tokens:** Store `access_token` and `refresh_token` for API calls

### Token Management

- **Access Token:** Valid for 1 hour
- **Refresh Token:** Long-lived, use to obtain new access tokens
- **Token Refresh:** Platform automatically refreshes tokens before sync operations

---

## API Endpoints

### 1. List Properties

Retrieve accessible GA4 properties for authenticated user.

**Endpoint:**
```
POST /api/google-analytics/properties
```

**Authentication:** JWT + Google OAuth access token

**Request Body:**
```json
{
  "access_token": "ya29.a0AfH6SMC..."
}
```

**Request Validation:**
- `access_token`: Required, must be non-empty string

**Response (200 OK):**
```json
{
  "properties": [
    {
      "name": "properties/123456789",
      "displayName": "My Website",
      "parent": "accounts/98765"
    },
    {
      "name": "properties/987654321",
      "displayName": "Mobile App",
      "parent": "accounts/98765"
    }
  ],
  "count": 2,
  "message": "Properties retrieved successfully"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/google-analytics/properties \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "ya29.a0AfH6SMC..."
  }'
```

---

### 2. Get Metadata

Retrieve available dimensions and metrics for a specific GA4 property.

**Endpoint:**
```
GET /api/google-analytics/metadata/:propertyId
```

**Authentication:** JWT + OAuth tokens in request body

**URL Parameters:**
- `propertyId`: GA4 property ID (e.g., "123456789")

**Request Body:**
```json
{
  "access_token": "ya29.a0AfH6SMC...",
  "refresh_token": "1//0gZ..."
}
```

**Request Validation:**
- `propertyId`: Required, must be string
- `access_token`: Required in request body
- `refresh_token`: Required in request body

**Response (200 OK):**
```json
{
  "metadata": {
    "dimensions": [
      {
        "apiName": "date",
        "uiName": "Date",
        "description": "The date of the event, formatted as YYYYMMDD",
        "category": "TIME"
      },
      {
        "apiName": "sessionSource",
        "uiName": "Session source",
        "description": "The source of traffic to the website",
        "category": "ACQUISITION"
      },
      {
        "apiName": "pagePath",
        "uiName": "Page path",
        "description": "The URL path of the page",
        "category": "PAGE"
      }
    ],
    "metrics": [
      {
        "apiName": "sessions",
        "uiName": "Sessions",
        "description": "Total number of sessions",
        "type": "INTEGER"
      },
      {
        "apiName": "totalUsers",
        "uiName": "Total users",
        "description": "Total number of users",
        "type": "INTEGER"
      },
      {
        "apiName": "bounceRate",
        "uiName": "Bounce rate",
        "description": "Percentage of sessions that were not engaged",
        "type": "FLOAT"
      }
    ]
  },
  "message": "Metadata retrieved successfully"
}
```

**JavaScript Example:**
```javascript
const propertyId = '123456789';
const accessToken = 'ya29.a0AfH6SMC...';
const refreshToken = '1//0gZ...';

const response = await fetch(
  `https://your-domain.com/api/google-analytics/metadata/${propertyId}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken
    })
  }
);

const data = await response.json();
console.log('Available dimensions:', data.metadata.dimensions.length);
console.log('Available metrics:', data.metadata.metrics.length);
```

---

### 3. Get Report Presets

Retrieve predefined report configurations.

**Endpoint:**
```
GET /api/google-analytics/report-presets
```

**Authentication:** JWT

**Request:** No body required

**Response (200 OK):**
```json
{
  "presets": [
    {
      "id": "traffic_overview",
      "name": "Traffic Overview",
      "description": "Overall traffic metrics by source and medium",
      "dimensions": ["date", "sessionSource", "sessionMedium"],
      "metrics": [
        "sessions",
        "totalUsers",
        "newUsers",
        "screenPageViews",
        "averageSessionDuration",
        "bounceRate"
      ]
    },
    {
      "id": "page_performance",
      "name": "Page Performance",
      "description": "Page-level engagement metrics",
      "dimensions": ["pagePath", "pageTitle"],
      "metrics": [
        "screenPageViews",
        "averageSessionDuration",
        "bounceRate"
      ]
    },
    {
      "id": "user_acquisition",
      "name": "User Acquisition",
      "description": "New user acquisition by channel",
      "dimensions": [
        "date",
        "firstUserSource",
        "firstUserMedium",
        "firstUserCampaignId"
      ],
      "metrics": [
        "newUsers",
        "sessions",
        "engagementRate",
        "conversions"
      ]
    },
    {
      "id": "geographic",
      "name": "Geographic",
      "description": "Traffic by geographic location",
      "dimensions": ["country", "city"],
      "metrics": [
        "totalUsers",
        "sessions",
        "screenPageViews",
        "averageSessionDuration"
      ]
    },
    {
      "id": "device",
      "name": "Device & Technology",
      "description": "Traffic by device, OS, and browser",
      "dimensions": ["deviceCategory", "operatingSystem", "browser"],
      "metrics": [
        "totalUsers",
        "sessions",
        "screenPageViews",
        "bounceRate"
      ]
    },
    {
      "id": "events",
      "name": "Events",
      "description": "Custom event tracking",
      "dimensions": ["date", "eventName"],
      "metrics": [
        "eventCount",
        "eventValue",
        "conversions"
      ]
    }
  ]
}
```

**Python Example:**
```python
import requests

response = requests.get(
    'https://your-domain.com/api/google-analytics/report-presets',
    headers={'Authorization': f'Bearer {jwt_token}'}
)

presets = response.json()['presets']
for preset in presets:
    print(f"{preset['name']}: {preset['description']}")
    print(f"  Dimensions: {', '.join(preset['dimensions'])}")
    print(f"  Metrics: {', '.join(preset['metrics'])}")
```

---

### 4. Add Data Source

Create a new Google Analytics 4 data source connection.

**Endpoint:**
```
POST /api/google-analytics/add-data-source
```

**Authentication:** JWT

**Request Body:**
```json
{
  "name": "Company Website - Production",
  "property_id": "123456789",
  "access_token": "ya29.a0AfH6SMC...",
  "refresh_token": "1//0gZ...",
  "project_id": 42,
  "sync_frequency": "daily"
}
```

**Request Validation:**
- `name`: Required, non-empty string, max 255 characters
- `property_id`: Required, numeric string
- `access_token`: Required, valid Google OAuth access token
- `refresh_token`: Required, valid Google OAuth refresh token
- `project_id`: Required, integer, must be a valid project ID user has access to
- `sync_frequency`: Required, one of: `"manual"`, `"hourly"`, `"daily"`, `"weekly"`

**Response (201 Created):**
```json
{
  "success": true,
  "data_source_id": 58,
  "message": "Google Analytics data source added successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    },
    {
      "field": "sync_frequency",
      "message": "Invalid sync frequency. Must be: manual, hourly, daily, or weekly"
    }
  ]
}
```

**JavaScript Example:**
```javascript
const createDataSource = async () => {
  const response = await fetch(
    'https://your-domain.com/api/google-analytics/add-data-source',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Company Website - Production',
        property_id: '123456789',
        access_token: accessToken,
        refresh_token: refreshToken,
        project_id: 42,
        sync_frequency: 'daily'
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create data source:', error);
    throw new Error(error.error);
  }

  const result = await response.json();
  console.log('Data source created:', result.dataSource.id);
  return result.dataSource;
};
```

---

### 5. Sync Data Source

Trigger manual synchronization for a GA4 data source.

**Endpoint:**
```
POST /api/google-analytics/sync/:dataSourceId
```

**Authentication:** JWT

**Rate Limiting:** Subject to expensive operations rate limiter

**URL Parameters:**
- `dataSourceId`: Integer, ID of the data source to sync

**Request Body:** Empty (`{}`)

**Request Validation:**
- `dataSourceId`: Must be valid integer
- User must have access to the data source
- Data source must be type `google_analytics`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync completed successfully"
}
```

**Error Response (429 Too Many Requests):**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many sync requests. Please wait before trying again.",
  "retryAfter": 60
}
```

**Python Example:**
```python
import requests
import time

def sync_data_source(jwt_token, data_source_id):
    response = requests.post(
        f'https://your-domain.com/api/google-analytics/sync/{data_source_id}',
        headers={
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        },
        json={}
    )
    
    if response.status_code == 429:
        retry_after = response.json().get('retryAfter', 60)
        print(f'Rate limited. Waiting {retry_after} seconds...')
        time.sleep(retry_after)
        return sync_data_source(jwt_token, data_source_id)
    
    response.raise_for_status()
    return response.json()

# Usage
result = sync_data_source(jwt_token, 58)
print(f"Sync status: {result['sync']['status']}")
```

---

### 6. Get Sync Status

Retrieve sync status and history for a GA4 data source.

**Endpoint:**
```
GET /api/google-analytics/sync-status/:dataSourceId
```

**Authentication:** JWT

**URL Parameters:**
- `dataSourceId`: Integer, ID of the data source

**Request:** No body required

**Response (200 OK):**
```json
{
  "last_sync": "2025-12-17T14:45:00Z",
  "sync_history": [
    {
      "data_source_id": 58,
      "synced_at": "2025-12-17T14:45:00Z",
      "status": "success"
    },
    {
      "data_source_id": 58,
      "synced_at": "2025-12-16T14:45:00Z",
      "status": "success"
    },
    {
      "data_source_id": 58,
      "synced_at": "2025-12-15T14:45:00Z",
      "status": "failed"
    }
  ],
  "message": "Sync status retrieved successfully"
}
```

**cURL Example:**
```bash
curl -X GET https://your-domain.com/api/google-analytics/sync-status/58 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Request/Response Formats

### Content Type

All requests must use:
```
Content-Type: application/json
```

### Date Formats

- **ISO 8601:** `2025-12-17T14:30:00Z` (UTC timestamps)
- **Date Only:** `2025-12-17` (for date fields)

### Common Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| **200** | OK | Request successful |
| **201** | Created | Resource created successfully |
| **202** | Accepted | Request accepted for background processing |
| **400** | Bad Request | Validation error or malformed request |
| **401** | Unauthorized | Missing or invalid JWT token |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource not found |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error occurred |
| **503** | Service Unavailable | GA4 API temporarily unavailable |

---

## Error Handling

### Error Response Format

All error responses follow this structure:

```json
{
  "error": "Error title or code",
  "message": "Human-readable description",
  "details": [
    {
      "field": "property_id",
      "message": "Invalid property ID format"
    }
  ],
  "timestamp": "2025-12-17T14:30:00Z",
  "requestId": "req_abc123xyz"
}
```

### Common Error Scenarios

#### 1. Invalid OAuth Token

**Request:**
```bash
POST /api/google-analytics/properties
{
  "access_token": "expired_token_abc123"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Authentication failed",
  "message": "Google OAuth token is invalid or expired",
  "details": {
    "error": "invalid_grant",
    "error_description": "Token has been expired or revoked"
  }
}
```

**Solution:** Refresh the OAuth token using the refresh token

#### 2. Property Not Accessible

**Request:**
```bash
POST /api/google-analytics/add-data-source
{
  "property_id": "999999999",
  ...
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Access denied",
  "message": "You do not have access to GA4 property 999999999",
  "details": {
    "propertyId": "999999999",
    "requiredPermission": "Read & Analyze"
  }
}
```

**Solution:** Verify property ID and ensure Google account has appropriate permissions

#### 3. Validation Errors

**Request:**
```bash
POST /api/google-analytics/add-data-source
{
  "name": "",
  "property_id": "123",
  "sync_frequency": "every_hour"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Request contains invalid fields",
  "details": [
    {
      "field": "name",
      "value": "",
      "message": "Name cannot be empty"
    },
    {
      "field": "sync_frequency",
      "value": "every_hour",
      "message": "Invalid value. Must be one of: manual, hourly, daily, weekly"
    },
    {
      "field": "access_token",
      "message": "Field is required"
    }
  ]
}
```

**Solution:** Fix validation errors and resubmit

#### 4. GA4 API Quota Exceeded

**Request:**
```bash
POST /api/google-analytics/sync/58
```

**Response (503 Service Unavailable):**
```json
{
  "error": "GA4 API quota exceeded",
  "message": "Google Analytics API daily quota limit reached",
  "details": {
    "quotaLimit": 15000,
    "quotaUsed": 15000,
    "resetTime": "2025-12-18T00:00:00Z"
  },
  "retryAfter": 7200
}
```

**Solution:** Wait for quota reset or upgrade GA4 API quota

---

## Rate Limiting

### Rate Limit Rules

The API implements rate limiting to protect against abuse:

| Operation | Limit | Window | Scope |
|-----------|-------|--------|-------|
| **List Properties** | 100 requests | 1 minute | Per user |
| **Get Metadata** | 50 requests | 1 minute | Per user |
| **Sync Operations** | 10 requests | 5 minutes | Per user |
| **General API** | 1000 requests | 1 hour | Per user |

### Rate Limit Headers

Response headers include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1702826400
```

### Handling Rate Limits

**Example with Exponential Backoff:**

```javascript
async function syncWithRetry(dataSourceId, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://your-domain.com/api/google-analytics/sync/${dataSourceId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        const backoff = Math.min(retryAfter * Math.pow(2, attempt), 300);
        console.log(`Rate limited. Waiting ${backoff}s before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, backoff * 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}
```

---

## Code Examples

### Complete Integration Flow

**Node.js/JavaScript:**

```javascript
const axios = require('axios');

class GoogleAnalyticsIntegration {
  constructor(baseUrl, jwtToken) {
    this.baseUrl = baseUrl;
    this.jwtToken = jwtToken;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async listProperties(accessToken) {
    const response = await this.client.post('/google-analytics/properties', {
      access_token: accessToken
    });
    return response.data.properties;
  }

  async getReportPresets() {
    const response = await this.client.get('/google-analytics/report-presets');
    return response.data.presets;
  }

  async createDataSource(config) {
    const response = await this.client.post('/google-analytics/add-data-source', {
      name: config.name,
      property_id: config.propertyId,
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      project_id: config.projectId,
      sync_frequency: config.syncFrequency || 'daily'
    });
    return response.data.dataSource;
  }

  async syncDataSource(dataSourceId) {
    try {
      const response = await this.client.post(
        `/google-analytics/sync/${dataSourceId}`,
        {}
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.retryAfter || 60;
        console.log(`Rate limited. Retry after ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.syncDataSource(dataSourceId);
      }
      throw error;
    }
  }

  async getSyncStatus(dataSourceId) {
    const response = await this.client.get(
      `/google-analytics/sync-status/${dataSourceId}`
    );
    return response.data;
  }

  async waitForSync(dataSourceId, pollInterval = 10000, maxWait = 600000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const status = await this.getSyncStatus(dataSourceId);
      
      if (status.lastSync?.status === 'completed') {
        return status;
      }
      
      if (status.lastSync?.status === 'failed') {
        throw new Error(`Sync failed: ${status.lastSync.errors}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Sync timeout exceeded');
  }
}

// Usage
const ga = new GoogleAnalyticsIntegration(
  'https://your-domain.com/api',
  'your_jwt_token'
);

const properties = await ga.listProperties(oauthAccessToken);
console.log('Available properties:', properties);

// Extract property ID from the name field (format: "properties/123456789")
const propertyId = properties[0].name.split('/')[1];

const dataSource = await ga.createDataSource({
  name: properties[0].displayName,
  propertyId: propertyId,
  accessToken: oauthAccessToken,
  refreshToken: oauthRefreshToken,
  projectId: 42,
  syncFrequency: 'daily'
});

await ga.syncDataSource(dataSource.id);
const finalStatus = await ga.waitForSync(dataSource.id);
console.log('Sync completed:', finalStatus.lastSync.recordsImported);
```

**Python:**

```python
import requests
import time
from typing import Dict, List, Optional

class GoogleAnalyticsIntegration:
    def __init__(self, base_url: str, jwt_token: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        })
    
    def list_properties(self, access_token: str) -> List[Dict]:
        response = self.session.post(
            f'{self.base_url}/google-analytics/properties',
            json={'access_token': access_token}
        )
        response.raise_for_status()
        return response.json()['properties']
    
    def get_report_presets(self) -> List[Dict]:
        response = self.session.get(
            f'{self.base_url}/google-analytics/report-presets'
        )
        response.raise_for_status()
        return response.json()['presets']
    
    def create_data_source(self, config: Dict) -> Dict:
        response = self.session.post(
            f'{self.base_url}/google-analytics/add-data-source',
            json={
                'name': config['name'],
                'property_id': config['property_id'],
                'access_token': config['access_token'],
                'refresh_token': config['refresh_token'],
                'project_id': config['project_id'],
                'sync_frequency': config.get('sync_frequency', 'daily')
            }
        )
        response.raise_for_status()
        return response.json()['dataSource']
    
    def sync_data_source(self, data_source_id: int, max_retries: int = 3) -> Dict:
        for attempt in range(max_retries):
            try:
                response = self.session.post(
                    f'{self.base_url}/google-analytics/sync/{data_source_id}',
                    json={}
                )
                
                if response.status_code == 429:
                    retry_after = response.json().get('retryAfter', 60)
                    backoff = min(retry_after * (2 ** attempt), 300)
                    print(f'Rate limited. Waiting {backoff}s...')
                    time.sleep(backoff)
                    continue
                
                response.raise_for_status()
                return response.json()
            
            except requests.exceptions.HTTPError as e:
                if attempt == max_retries - 1:
                    raise
        
        raise Exception('Max retries exceeded')
    
    def get_sync_status(self, data_source_id: int) -> Dict:
        response = self.session.get(
            f'{self.base_url}/google-analytics/sync-status/{data_source_id}'
        )
        response.raise_for_status()
        return response.json()
    
    def wait_for_sync(
        self,
        data_source_id: int,
        poll_interval: int = 10,
        max_wait: int = 600
    ) -> Dict:
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status = self.get_sync_status(data_source_id)
            
            if status.get('lastSync', {}).get('status') == 'completed':
                return status
            
            if status.get('lastSync', {}).get('status') == 'failed':
                errors = status['lastSync'].get('errors', 'Unknown error')
                raise Exception(f'Sync failed: {errors}')
            
            time.sleep(poll_interval)
        
        raise Exception('Sync timeout exceeded')

# Usage
ga = GoogleAnalyticsIntegration(
    'https://your-domain.com/api',
    'your_jwt_token'
)

properties = ga.list_properties(oauth_access_token)
print(f'Found {len(properties)} properties')

# Extract property ID from name field
property_id = properties[0]['name'].split('/')[1]

data_source = ga.create_data_source({
    'name': properties[0]['displayName'],
    'property_id': property_id,
    'access_token': oauth_access_token,
    'refresh_token': oauth_refresh_token,
    'project_id': 42,
    'sync_frequency': 'daily'
})

ga.sync_data_source(data_source['id'])
final_status = ga.wait_for_sync(data_source['id'])
print(f"Sync completed: {final_status['lastSync']['recordsImported']} records")
```

---

## Integration Patterns

### Pattern 1: Scheduled Sync Monitor

Monitor scheduled syncs and alert on failures:

```javascript
async function monitorSync(dataSourceId, webhookUrl) {
  const status = await fetch(
    `https://your-domain.com/api/google-analytics/sync-status/${dataSourceId}`,
    { headers: { 'Authorization': `Bearer ${jwtToken}` } }
  ).then(r => r.json());

  if (status.lastSync?.status === 'failed') {
    // Alert via webhook
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'GA4 Sync Failed',
        dataSourceId: dataSourceId,
        dataSourceName: status.name,
        error: status.lastSync.errors,
        timestamp: status.lastSync.startedAt
      })
    });
  }

  return status;
}

// Run every hour
setInterval(() => monitorSync(58, 'https://alerts.example.com/webhook'), 3600000);
```

### Pattern 2: Bulk Data Source Setup

Create multiple data sources programmatically:

```python
def setup_multiple_properties(ga_client, oauth_tokens, project_id):
    properties = ga_client.list_properties(oauth_tokens['access_token'])
    
    data_sources = []
    for prop in properties:
        data_source = ga_client.create_data_source({
            'name': prop['displayName'],
            'property_id': prop['propertyId'],
            'access_token': oauth_tokens['access_token'],
            'refresh_token': oauth_tokens['refresh_token'],
            'project_id': project_id,
            'sync_frequency': 'daily'
        })
        data_sources.append(data_source)
        
        # Trigger initial sync
        ga_client.sync_data_source(data_source['id'])
    
    return data_sources
```

### Pattern 3: Sync Status Dashboard

Build a real-time dashboard:

```javascript
async function getSyncDashboard(dataSourceIds) {
  const statuses = await Promise.all(
    dataSourceIds.map(id =>
      fetch(`https://your-domain.com/api/google-analytics/sync-status/${id}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      }).then(r => r.json())
    )
  );

  return statuses.map(status => ({
    id: status.dataSourceId,
    name: status.name,
    lastSyncStatus: status.lastSync?.status || 'never',
    lastSyncTime: status.lastSync?.timestamp,
    nextSync: status.nextScheduledSync,
    recordsImported: status.lastSync?.recordsImported || 0,
    syncFrequency: status.syncFrequency
  }));
}
```

---

## Best Practices

### 1. OAuth Token Management

- **Refresh Proactively:** Refresh access tokens before they expire (typically < 55 minutes)
- **Secure Storage:** Store refresh tokens securely (encrypted at rest)
- **Error Handling:** Implement token refresh logic in error handlers

### 2. Rate Limiting

- **Respect Limits:** Don't retry immediately after 429 responses
- **Implement Backoff:** Use exponential backoff for retries
- **Monitor Headers:** Check rate limit headers to avoid hitting limits

### 3. Sync Operations

- **Avoid Over-Syncing:** Don't sync more frequently than necessary
- **Monitor Duration:** Track sync duration to identify performance issues
- **Handle Failures:** Implement retry logic for transient failures

### 4. Error Handling

- **Log All Errors:** Comprehensive logging for debugging
- **User-Friendly Messages:** Convert technical errors to user-friendly messages
- **Retry Transient Errors:** Network errors, timeouts, 5xx errors

### 5. Data Validation

- **Validate Input:** Check all user inputs before API calls
- **Type Safety:** Use TypeScript or type hints for better reliability
- **Test Edge Cases:** Empty strings, null values, invalid IDs

### 6. Security

- **HTTPS Only:** Always use HTTPS for API calls
- **Secure Tokens:** Never log or expose OAuth tokens
- **JWT Expiry:** Implement JWT refresh before expiry
- **Principle of Least Privilege:** Request minimum necessary OAuth scopes

---

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Maintained By:** Data Research Analysis Team
