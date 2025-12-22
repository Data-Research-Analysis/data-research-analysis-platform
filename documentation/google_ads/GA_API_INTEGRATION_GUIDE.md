# Google Ads API Integration Guide

## Overview

This document provides comprehensive API documentation for integrating with the Google Ads data source in the Data Research Analysis platform. It covers authentication, available endpoints, request/response formats, error handling, and best practices for developers building custom integrations.

### Base URL

```
Development: http://localhost:8000/api
Production: https://your-domain.com/api
```

### Authentication

All API requests must include a valid JWT token in the `Authorization` header (except for login endpoints).

```http
Authorization: Bearer <your_jwt_token>
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [OAuth Flow](#oauth-flow)
3. [Data Source Management](#data-source-management)
4. [Sync Operations](#sync-operations)
5. [Metadata Endpoints](#metadata-endpoints)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Code Examples](#code-examples)
9. [Best Practices](#best-practices)

---

## Authentication

### Get JWT Token

**Endpoint**: `POST /auth/login`

Obtain a JWT token for API authentication.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

---

## OAuth Flow

### Step 1: Generate OAuth URL

**Endpoint**: `GET /oauth/google/url`

Generate a Google OAuth consent URL for Google Ads access.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | string | Yes | Must be `google_ads` |

**Response**:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent"
}
```

**cURL Example**:
```bash
curl -X GET "http://localhost:8000/api/oauth/google/url?service=google_ads" \
  -H "Authorization: Bearer <your_jwt_token>"
```

**JavaScript Example**:
```javascript
async function getGoogleAdsOAuthUrl() {
  const response = await fetch('http://localhost:8000/api/oauth/google/url?service=google_ads', {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  const data = await response.json();
  
  // Redirect user to OAuth consent screen
  window.location.href = data.url;
}
```

**Python Example**:
```python
import requests

def get_oauth_url(jwt_token):
    response = requests.get(
        'http://localhost:8000/api/oauth/google/url',
        params={'service': 'google_ads'},
        headers={'Authorization': f'Bearer {jwt_token}'}
    )
    
    return response.json()['url']
```

### Step 2: Exchange Authorization Code

**Endpoint**: `POST /oauth/google/callback`

Exchange the authorization code received from Google for access and refresh tokens.

**Request Body**:
```json
{
  "code": "4/0AX4XfWh_abc123...",
  "service": "google_ads"
}
```

**Response**:
```json
{
  "access_token": "ya29.a0AfH6SMBw...",
  "refresh_token": "1//0gKN2Dw8...",
  "expiry_date": 1706789123456,
  "scope": "https://www.googleapis.com/auth/adwords",
  "token_type": "Bearer"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:8000/api/oauth/google/callback \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AX4XfWh_abc123...",
    "service": "google_ads"
  }'
```

**JavaScript Example**:
```javascript
async function exchangeCodeForTokens(authCode) {
  const response = await fetch('http://localhost:8000/api/oauth/google/callback', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: authCode,
      service: 'google_ads'
    })
  });
  
  return await response.json();
}
```

**Python Example**:
```python
def exchange_auth_code(jwt_token, auth_code):
    response = requests.post(
        'http://localhost:8000/api/oauth/google/callback',
        headers={
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        },
        json={
            'code': auth_code,
            'service': 'google_ads'
        }
    )
    
    return response.json()
```

---

## Data Source Management

### List Google Ads Accounts

**Endpoint**: `POST /google-ads/accounts`

Retrieve a list of Google Ads accounts accessible with the provided access token.

**Request Body**:
```json
{
  "accessToken": "ya29.a0AfH6SMBw..."
}
```

**Response**:
```json
{
  "success": true,
  "accounts": [
    {
      "id": "123-456-7890",
      "name": "Acme Corp Main Account",
      "type": "CUSTOMER",
      "currency": "USD",
      "timezone": "America/New_York"
    },
    {
      "id": "987-654-3210",
      "name": "Acme Corp - EU",
      "type": "CUSTOMER",
      "currency": "EUR",
      "timezone": "Europe/London"
    }
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Invalid access token"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:8000/api/google-ads/accounts \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "ya29.a0AfH6SMBw..."
  }'
```

**JavaScript Example**:
```javascript
async function listGoogleAdsAccounts(accessToken) {
  const response = await fetch('http://localhost:8000/api/google-ads/accounts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ accessToken })
  });
  
  const data = await response.json();
  return data.accounts;
}
```

**Python Example**:
```python
def list_google_ads_accounts(jwt_token, access_token):
    response = requests.post(
        'http://localhost:8000/api/google-ads/accounts',
        headers={
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        },
        json={'accessToken': access_token}
    )
    
    data = response.json()
    return data.get('accounts', [])
```

### Get Available Report Types

**Endpoint**: `GET /google-ads/report-types`

Retrieve metadata about available Google Ads report types.

**Response**:
```json
{
  "success": true,
  "reportTypes": [
    {
      "id": "campaign",
      "name": "Campaign Performance",
      "description": "Ad spend, conversions, and ROAS by campaign",
      "dimensions": ["Date", "Campaign"],
      "metrics": [
        "Cost",
        "Conversions",
        "Conversion Value",
        "ROAS",
        "CTR",
        "CPC",
        "CPM",
        "Impressions",
        "Clicks"
      ]
    },
    {
      "id": "keyword",
      "name": "Keyword Performance",
      "description": "CPC, quality score, and conversions by keyword",
      "dimensions": ["Date", "Campaign", "Ad Group", "Keyword", "Match Type"],
      "metrics": [
        "Impressions",
        "Clicks",
        "Cost",
        "Conversions",
        "CTR",
        "CPC",
        "Quality Score"
      ]
    },
    {
      "id": "geographic",
      "name": "Geographic Performance",
      "description": "Performance by country, region, city",
      "dimensions": ["Date", "Country", "Region", "City"],
      "metrics": [
        "Impressions",
        "Clicks",
        "Cost",
        "Conversions",
        "Conversion Value"
      ]
    },
    {
      "id": "device",
      "name": "Device Performance",
      "description": "Mobile, desktop, tablet breakdown",
      "dimensions": ["Date", "Device"],
      "metrics": [
        "Impressions",
        "Clicks",
        "Cost",
        "Conversions",
        "Conversion Value",
        "CTR",
        "CPC"
      ]
    }
  ]
}
```

**cURL Example**:
```bash
curl -X GET http://localhost:8000/api/google-ads/report-types \
  -H "Authorization: Bearer <your_jwt_token>"
```

**JavaScript Example**:
```javascript
async function getReportTypes() {
  const response = await fetch('http://localhost:8000/api/google-ads/report-types', {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  const data = await response.json();
  return data.reportTypes;
}
```

### Create Google Ads Data Source

**Endpoint**: `POST /google-ads/add`

Create a new Google Ads data source with sync configuration.

**Request Body**:
```json
{
  "name": "Q1 Marketing Campaigns",
  "customerId": "123-456-7890",
  "accessToken": "ya29.a0AfH6SMBw...",
  "refreshToken": "1//0gKN2Dw8...",
  "reportTypes": ["campaign", "keyword", "geographic"],
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the data source |
| `customerId` | string | Yes | Google Ads customer ID (format: XXX-XXX-XXXX) |
| `accessToken` | string | Yes | OAuth access token |
| `refreshToken` | string | Yes | OAuth refresh token |
| `reportTypes` | array | Yes | Array of report type IDs to sync |
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |

**Response**:
```json
{
  "success": true,
  "dataSourceId": 42
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Missing required fields: customerId"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:8000/api/google-ads/add \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q1 Marketing Campaigns",
    "customerId": "123-456-7890",
    "accessToken": "ya29.a0AfH6SMBw...",
    "refreshToken": "1//0gKN2Dw8...",
    "reportTypes": ["campaign", "keyword"],
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }'
```

**JavaScript Example**:
```javascript
async function createGoogleAdsDataSource(config) {
  const response = await fetch('http://localhost:8000/api/google-ads/add', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log(`Data source created with ID: ${data.dataSourceId}`);
    return data.dataSourceId;
  } else {
    throw new Error(data.error);
  }
}

// Usage
const dataSourceId = await createGoogleAdsDataSource({
  name: 'Q1 Marketing Campaigns',
  customerId: '123-456-7890',
  accessToken: 'ya29.a0AfH6SMBw...',
  refreshToken: '1//0gKN2Dw8...',
  reportTypes: ['campaign', 'keyword', 'geographic'],
  startDate: '2024-01-01',
  endDate: '2024-03-31'
});
```

**Python Example**:
```python
def create_google_ads_data_source(jwt_token, config):
    response = requests.post(
        'http://localhost:8000/api/google-ads/add',
        headers={
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        },
        json=config
    )
    
    data = response.json()
    
    if data['success']:
        print(f"Data source created with ID: {data['dataSourceId']}")
        return data['dataSourceId']
    else:
        raise Exception(data['error'])

# Usage
data_source_id = create_google_ads_data_source(jwt_token, {
    'name': 'Q1 Marketing Campaigns',
    'customerId': '123-456-7890',
    'accessToken': 'ya29.a0AfH6SMBw...',
    'refreshToken': '1//0gKN2Dw8...',
    'reportTypes': ['campaign', 'keyword', 'geographic'],
    'startDate': '2024-01-01',
    'endDate': '2024-03-31'
})
```

---

## Sync Operations

### Trigger Manual Sync

**Endpoint**: `POST /google-ads/sync/:id`

Trigger a manual synchronization of Google Ads data for a specific data source.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Data source ID |

**Response**:
```json
{
  "success": true,
  "message": "Sync completed successfully"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Data source not found or access denied"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:8000/api/google-ads/sync/42 \
  -H "Authorization: Bearer <your_jwt_token>"
```

**JavaScript Example**:
```javascript
async function triggerSync(dataSourceId) {
  const response = await fetch(`http://localhost:8000/api/google-ads/sync/${dataSourceId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Sync completed successfully');
  } else {
    console.error('Sync failed:', data.error);
  }
  
  return data;
}
```

**Python Example**:
```python
def trigger_sync(jwt_token, data_source_id):
    response = requests.post(
        f'http://localhost:8000/api/google-ads/sync/{data_source_id}',
        headers={'Authorization': f'Bearer {jwt_token}'}
    )
    
    data = response.json()
    
    if data['success']:
        print('Sync completed successfully')
    else:
        print(f"Sync failed: {data['error']}")
    
    return data
```

### Get Sync Status

**Endpoint**: `GET /google-ads/status/:id`

Retrieve the sync status and history for a Google Ads data source.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Data source ID |

**Response**:
```json
{
  "success": true,
  "status": {
    "lastSyncTime": "2024-01-15T10:30:00Z",
    "status": "COMPLETED",
    "recordsSynced": 1250,
    "recordsFailed": 0,
    "error": null
  },
  "history": [
    {
      "id": 156,
      "data_source_id": 42,
      "sync_type": "MANUAL",
      "status": "COMPLETED",
      "started_at": "2024-01-15T10:29:45Z",
      "completed_at": "2024-01-15T10:30:15Z",
      "records_synced": 1250,
      "records_failed": 0,
      "error_message": null,
      "sync_config": {
        "reportTypes": ["campaign", "keyword"],
        "startDate": "2024-01-01",
        "endDate": "2024-01-31",
        "customerId": "123-456-7890"
      }
    },
    {
      "id": 145,
      "data_source_id": 42,
      "sync_type": "MANUAL",
      "status": "FAILED",
      "started_at": "2024-01-14T08:15:00Z",
      "completed_at": "2024-01-14T08:15:30Z",
      "records_synced": 0,
      "records_failed": 0,
      "error_message": "Token expired"
    }
  ]
}
```

**Sync Status Values**:
- `PENDING`: Sync queued but not started
- `RUNNING`: Sync in progress
- `COMPLETED`: Sync completed successfully
- `FAILED`: Sync failed with error

**cURL Example**:
```bash
curl -X GET http://localhost:8000/api/google-ads/status/42 \
  -H "Authorization: Bearer <your_jwt_token>"
```

**JavaScript Example**:
```javascript
async function getSyncStatus(dataSourceId) {
  const response = await fetch(`http://localhost:8000/api/google-ads/status/${dataSourceId}`, {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  const data = await response.json();
  
  console.log(`Last sync: ${data.status.lastSyncTime}`);
  console.log(`Status: ${data.status.status}`);
  console.log(`Records synced: ${data.status.recordsSynced}`);
  
  return data;
}

// Poll sync status every 5 seconds
async function pollSyncStatus(dataSourceId) {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await getSyncStatus(dataSourceId);
    
    if (status.status.status === 'COMPLETED') {
      console.log('Sync completed!');
      return status;
    } else if (status.status.status === 'FAILED') {
      throw new Error(`Sync failed: ${status.status.error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  throw new Error('Sync timeout');
}
```

**Python Example**:
```python
import time

def get_sync_status(jwt_token, data_source_id):
    response = requests.get(
        f'http://localhost:8000/api/google-ads/status/{data_source_id}',
        headers={'Authorization': f'Bearer {jwt_token}'}
    )
    
    data = response.json()
    
    print(f"Last sync: {data['status']['lastSyncTime']}")
    print(f"Status: {data['status']['status']}")
    print(f"Records synced: {data['status']['recordsSynced']}")
    
    return data

def poll_sync_status(jwt_token, data_source_id, max_attempts=60):
    """Poll sync status every 5 seconds until completion"""
    attempts = 0
    
    while attempts < max_attempts:
        status = get_sync_status(jwt_token, data_source_id)
        
        if status['status']['status'] == 'COMPLETED':
            print('Sync completed!')
            return status
        elif status['status']['status'] == 'FAILED':
            raise Exception(f"Sync failed: {status['status']['error']}")
        
        time.sleep(5)
        attempts += 1
    
    raise Exception('Sync timeout')
```

---

## Metadata Endpoints

### List All Data Sources

**Endpoint**: `GET /data-sources`

Retrieve all data sources for the authenticated user.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by source type (e.g., `google_ads`) |
| `project_id` | integer | No | Filter by project ID |

**Response**:
```json
{
  "success": true,
  "dataSources": [
    {
      "id": 42,
      "name": "Q1 Marketing Campaigns",
      "source_type": "google_ads",
      "created_at": "2024-01-10T14:30:00Z",
      "last_sync": "2024-01-15T10:30:00Z",
      "status": "COMPLETED",
      "config": {
        "customerId": "123-456-7890",
        "reportTypes": ["campaign", "keyword"]
      }
    },
    {
      "id": 38,
      "name": "Website Analytics",
      "source_type": "google_analytics",
      "created_at": "2024-01-05T09:00:00Z",
      "last_sync": "2024-01-16T06:00:00Z",
      "status": "COMPLETED"
    }
  ]
}
```

**cURL Example**:
```bash
curl -X GET "http://localhost:8000/api/data-sources?type=google_ads" \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Delete Data Source

**Endpoint**: `DELETE /data-sources/:id`

Delete a Google Ads data source and all associated synced data.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Data source ID |

**Response**:
```json
{
  "success": true,
  "message": "Data source deleted successfully"
}
```

**cURL Example**:
```bash
curl -X DELETE http://localhost:8000/api/data-sources/42 \
  -H "Authorization: Bearer <your_jwt_token>"
```

---

## Error Handling

### Standard Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### HTTP Status Codes

| Status Code | Meaning | Common Scenarios |
|-------------|---------|------------------|
| `200` | Success | Request completed successfully |
| `400` | Bad Request | Missing required fields, invalid data format |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | User doesn't have access to resource |
| `404` | Not Found | Data source or resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `503` | Service Unavailable | Google Ads API unavailable |

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `AUTH_REQUIRED` | No JWT token provided | Include `Authorization` header |
| `INVALID_TOKEN` | JWT token expired or invalid | Re-authenticate to get new token |
| `INVALID_OAUTH_TOKEN` | Google OAuth token invalid | Re-authorize with Google |
| `TOKEN_EXPIRED` | OAuth token expired | Refresh token automatically handled |
| `CUSTOMER_NOT_FOUND` | Google Ads customer ID invalid | Verify customer ID format |
| `INVALID_DATE_RANGE` | Date range invalid | Check start/end date format and logic |
| `REPORT_TYPE_NOT_SUPPORTED` | Report type doesn't exist | Check available report types |
| `QUOTA_EXCEEDED` | Google Ads API quota exceeded | Wait and retry, or upgrade quota |
| `DATA_SOURCE_NOT_FOUND` | Data source ID doesn't exist | Verify data source ID |
| `SYNC_IN_PROGRESS` | Sync already running | Wait for current sync to complete |

### Error Handling Example

**JavaScript**:
```javascript
async function handleApiCall(apiFunction) {
  try {
    const result = await apiFunction();
    return result;
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          console.error('Authentication failed. Please log in again.');
          // Redirect to login
          break;
        case 429:
          console.error('Rate limit exceeded. Retrying in 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          return handleApiCall(apiFunction); // Retry
        case 500:
          console.error('Server error:', data.error);
          // Show user-friendly error
          break;
        default:
          console.error(`Error ${status}:`, data.error);
      }
    }
    throw error;
  }
}
```

**Python**:
```python
import time

def handle_api_call(api_function):
    try:
        result = api_function()
        return result
    except requests.exceptions.HTTPError as error:
        status = error.response.status_code
        data = error.response.json()
        
        if status == 401:
            print('Authentication failed. Please log in again.')
            # Redirect to login
        elif status == 429:
            print('Rate limit exceeded. Retrying in 60 seconds...')
            time.sleep(60)
            return handle_api_call(api_function)  # Retry
        elif status == 500:
            print(f"Server error: {data['error']}")
            # Show user-friendly error
        else:
            print(f"Error {status}: {data['error']}")
        
        raise error
```

---

## Rate Limiting

### Platform Rate Limits

The Data Research Analysis platform implements rate limiting to ensure fair usage:

| Endpoint | Limit | Window |
|----------|-------|--------|
| All API endpoints | 1000 requests | per hour |
| `/google-ads/sync/:id` | 10 syncs | per hour per data source |
| `/google-ads/accounts` | 100 requests | per hour |

### Google Ads API Limits

Google Ads API has its own rate limits:

| Access Level | Operations/Day | Requests/Minute |
|--------------|----------------|-----------------|
| Basic Access | 15,000 | 1,000 |
| Standard Access | 10,000 | 1,000 |

### Rate Limit Headers

API responses include rate limit information in headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1706789123
```

### Handling Rate Limits

**JavaScript Example**:
```javascript
async function makeAdsApiRequest(requestFn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const waitTime = (resetTime * 1000) - Date.now();
        
        if (attempt < maxRetries - 1) {
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw new Error('Rate limit exceeded after max retries');
        }
      } else {
        throw error;
      }
    }
  }
}
```

**Python Example with Exponential Backoff**:
```python
import time
from datetime import datetime

def make_ads_api_request(request_fn, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = request_fn()
            return response
        except requests.exceptions.HTTPError as error:
            if error.response.status_code == 429:
                reset_time = int(error.response.headers.get('x-ratelimit-reset', 0))
                wait_time = max(reset_time - int(time.time()), 0)
                
                if attempt < max_retries - 1:
                    # Exponential backoff
                    backoff_time = min(wait_time or (2 ** attempt), 300)  # Max 5 minutes
                    print(f'Rate limited. Waiting {backoff_time}s before retry...')
                    time.sleep(backoff_time)
                else:
                    raise Exception('Rate limit exceeded after max retries')
            else:
                raise error
```

---

## Code Examples

### Complete Integration Example (JavaScript)

```javascript
class GoogleAdsClient {
  constructor(baseUrl, jwtToken) {
    this.baseUrl = baseUrl;
    this.jwtToken = jwtToken;
  }
  
  async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  }
  
  // OAuth flow
  async getOAuthUrl() {
    const data = await this.request('GET', '/oauth/google/url?service=google_ads');
    return data.url;
  }
  
  async exchangeCode(authCode) {
    return await this.request('POST', '/oauth/google/callback', {
      code: authCode,
      service: 'google_ads'
    });
  }
  
  // Account management
  async listAccounts(accessToken) {
    const data = await this.request('POST', '/google-ads/accounts', { accessToken });
    return data.accounts;
  }
  
  async getReportTypes() {
    const data = await this.request('GET', '/google-ads/report-types');
    return data.reportTypes;
  }
  
  // Data source management
  async createDataSource(config) {
    const data = await this.request('POST', '/google-ads/add', config);
    return data.dataSourceId;
  }
  
  async syncDataSource(dataSourceId) {
    return await this.request('POST', `/google-ads/sync/${dataSourceId}`);
  }
  
  async getStatus(dataSourceId) {
    return await this.request('GET', `/google-ads/status/${dataSourceId}`);
  }
  
  // Full workflow
  async setupGoogleAdsConnection(config) {
    // 1. Get OAuth URL
    const oauthUrl = await this.getOAuthUrl();
    console.log('Please visit:', oauthUrl);
    
    // Note: In practice, you'd open this URL in a browser
    // and handle the callback server-side
    
    // 2. Exchange code for tokens (assuming you have the code)
    const tokens = await this.exchangeCode(config.authCode);
    
    // 3. List accounts
    const accounts = await this.listAccounts(tokens.access_token);
    console.log('Available accounts:', accounts);
    
    // 4. Create data source
    const dataSourceId = await this.createDataSource({
      name: config.name,
      customerId: config.customerId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      reportTypes: config.reportTypes,
      startDate: config.startDate,
      endDate: config.endDate
    });
    
    console.log(`Data source created: ${dataSourceId}`);
    
    // 5. Trigger sync
    await this.syncDataSource(dataSourceId);
    
    // 6. Poll for completion
    await this.waitForSync(dataSourceId);
    
    return dataSourceId;
  }
  
  async waitForSync(dataSourceId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(dataSourceId);
      
      if (status.status.status === 'COMPLETED') {
        console.log(`Sync completed! ${status.status.recordsSynced} records synced.`);
        return status;
      } else if (status.status.status === 'FAILED') {
        throw new Error(`Sync failed: ${status.status.error}`);
      }
      
      console.log(`Sync status: ${status.status.status}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Sync timeout');
  }
}

// Usage
const client = new GoogleAdsClient('http://localhost:8000/api', 'your_jwt_token');

await client.setupGoogleAdsConnection({
  authCode: '4/0AX4XfWh...',  // From OAuth callback
  name: 'Q1 Campaigns',
  customerId: '123-456-7890',
  reportTypes: ['campaign', 'keyword'],
  startDate: '2024-01-01',
  endDate: '2024-03-31'
});
```

### Complete Integration Example (Python)

```python
import requests
import time
from typing import List, Dict, Optional

class GoogleAdsClient:
    def __init__(self, base_url: str, jwt_token: str):
        self.base_url = base_url
        self.jwt_token = jwt_token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json'
        })
    
    def request(self, method: str, endpoint: str, data: Optional[Dict] = None):
        url = f'{self.base_url}{endpoint}'
        
        if method == 'GET':
            response = self.session.get(url, params=data)
        elif method == 'POST':
            response = self.session.post(url, json=data)
        elif method == 'DELETE':
            response = self.session.delete(url)
        else:
            raise ValueError(f'Unsupported HTTP method: {method}')
        
        response.raise_for_status()
        return response.json()
    
    # OAuth flow
    def get_oauth_url(self) -> str:
        data = self.request('GET', '/oauth/google/url', {'service': 'google_ads'})
        return data['url']
    
    def exchange_code(self, auth_code: str) -> Dict:
        return self.request('POST', '/oauth/google/callback', {
            'code': auth_code,
            'service': 'google_ads'
        })
    
    # Account management
    def list_accounts(self, access_token: str) -> List[Dict]:
        data = self.request('POST', '/google-ads/accounts', {'accessToken': access_token})
        return data['accounts']
    
    def get_report_types(self) -> List[Dict]:
        data = self.request('GET', '/google-ads/report-types')
        return data['reportTypes']
    
    # Data source management
    def create_data_source(self, config: Dict) -> int:
        data = self.request('POST', '/google-ads/add', config)
        return data['dataSourceId']
    
    def sync_data_source(self, data_source_id: int) -> Dict:
        return self.request('POST', f'/google-ads/sync/{data_source_id}')
    
    def get_status(self, data_source_id: int) -> Dict:
        return self.request('GET', f'/google-ads/status/{data_source_id}')
    
    # Full workflow
    def setup_google_ads_connection(self, config: Dict) -> int:
        """Complete setup workflow"""
        # 1. Get OAuth URL
        oauth_url = self.get_oauth_url()
        print(f'Please visit: {oauth_url}')
        
        # 2. Exchange code for tokens
        tokens = self.exchange_code(config['auth_code'])
        
        # 3. List accounts
        accounts = self.list_accounts(tokens['access_token'])
        print(f'Available accounts: {accounts}')
        
        # 4. Create data source
        data_source_id = self.create_data_source({
            'name': config['name'],
            'customerId': config['customer_id'],
            'accessToken': tokens['access_token'],
            'refreshToken': tokens['refresh_token'],
            'reportTypes': config['report_types'],
            'startDate': config['start_date'],
            'endDate': config['end_date']
        })
        
        print(f'Data source created: {data_source_id}')
        
        # 5. Trigger sync
        self.sync_data_source(data_source_id)
        
        # 6. Wait for completion
        self.wait_for_sync(data_source_id)
        
        return data_source_id
    
    def wait_for_sync(self, data_source_id: int, max_attempts: int = 60):
        """Poll sync status until completion"""
        for i in range(max_attempts):
            status = self.get_status(data_source_id)
            
            if status['status']['status'] == 'COMPLETED':
                print(f"Sync completed! {status['status']['recordsSynced']} records synced.")
                return status
            elif status['status']['status'] == 'FAILED':
                raise Exception(f"Sync failed: {status['status']['error']}")
            
            print(f"Sync status: {status['status']['status']}...")
            time.sleep(5)
        
        raise Exception('Sync timeout')

# Usage
client = GoogleAdsClient('http://localhost:8000/api', 'your_jwt_token')

data_source_id = client.setup_google_ads_connection({
    'auth_code': '4/0AX4XfWh...',  # From OAuth callback
    'name': 'Q1 Campaigns',
    'customer_id': '123-456-7890',
    'report_types': ['campaign', 'keyword'],
    'start_date': '2024-01-01',
    'end_date': '2024-03-31'
})

print(f'Setup complete! Data source ID: {data_source_id}')
```

---

## Best Practices

### 1. Token Management

**DO**:
- Store refresh tokens securely (encrypted database, secrets manager)
- Implement automatic token refresh logic
- Handle token expiry gracefully

**DON'T**:
- Store tokens in client-side code or localStorage
- Hardcode tokens in source code
- Share tokens between environments

### 2. Sync Strategy

**DO**:
- Implement retry logic with exponential backoff
- Monitor sync status and handle failures
- Use appropriate date ranges (avoid syncing entire account history unnecessarily)
- Batch syncs for multiple data sources

**DON'T**:
- Trigger syncs too frequently (respect rate limits)
- Ignore sync errors
- Re-sync the same date range repeatedly without reason

### 3. Error Handling

**DO**:
- Implement comprehensive error handling
- Log errors for debugging
- Provide user-friendly error messages
- Implement circuit breakers for repeated failures

**DON'T**:
- Silently swallow errors
- Expose sensitive error details to end users
- Retry indefinitely without backoff

### 4. Performance

**DO**:
- Use webhooks or scheduled syncs instead of polling when possible
- Implement caching for report types and account lists
- Paginate large result sets
- Use connection pooling for database operations

**DON'T**:
- Make unnecessary API calls
- Sync data you don't need
- Poll sync status too frequently (5-10 second intervals are appropriate)

### 5. Security

**DO**:
- Validate all user inputs
- Use HTTPS for all API communications
- Implement proper authentication and authorization
- Rotate credentials regularly

**DON'T**:
- Trust client-side data without validation
- Expose internal error details
- Use weak JWT secrets

---

## Support

For additional support:

- **Technical Documentation**: [GOOGLE_ADS_DOCUMENTATION.md](./GOOGLE_ADS_DOCUMENTATION.md)
- **User Guide**: [GA_USER_GUIDE.md](./GA_USER_GUIDE.md)
- **Report Types Reference**: [GA_REPORT_TYPES_REFERENCE.md](./GA_REPORT_TYPES_REFERENCE.md)
- **TypeScript Types**: [GA_TYPES_REFERENCE.md](./GA_TYPES_REFERENCE.md)

### External Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Documentation](https://oauth.net/2/)
