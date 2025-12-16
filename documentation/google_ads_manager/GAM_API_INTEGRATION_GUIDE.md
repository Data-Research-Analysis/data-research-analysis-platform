# Google Ad Manager API Integration Guide

**Developer Documentation for GAM Integration Endpoints**

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [WebSocket Events](#websocket-events)
8. [Code Examples](#code-examples)
9. [SDK Integration](#sdk-integration)

---

## Overview

The Google Ad Manager integration provides RESTful API endpoints for managing GAM connections, syncing data, scheduling automated syncs, and exporting reports.

### Base URL

```
http://localhost:3002/api
```

### API Version

Current version: **v1**  
All endpoints are prefixed with `/api`

### Content Type

All requests and responses use `application/json` unless otherwise specified.

### Authentication

All API endpoints require authentication using JWT tokens in the Authorization header.

---

## Authentication

### OAuth 2.0 Flow

The GAM integration uses Google OAuth 2.0 for authentication.

#### 1. Initiate OAuth Flow

**Endpoint:** `GET /google-ad-manager/oauth/url`

Generates the Google OAuth authorization URL.

**Request:**
```http
GET /api/google-ad-manager/oauth/url HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&scope=https://www.googleapis.com/auth/dfp&response_type=code&access_type=offline&prompt=consent"
}
```

**Parameters in Auth URL:**
- `client_id`: OAuth client ID
- `redirect_uri`: Callback URL
- `scope`: `https://www.googleapis.com/auth/dfp` (Google Ad Manager API)
- `access_type`: `offline` (to receive refresh token)
- `prompt`: `consent` (force consent screen)

#### 2. Handle OAuth Callback

**Endpoint:** `GET /google-ad-manager/oauth/callback`

Receives the authorization code from Google and exchanges it for tokens.

**Request:**
```http
GET /api/google-ad-manager/oauth/callback?code=<auth_code>&state=<state_token> HTTP/1.1
Host: localhost:3002
```

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: State token for CSRF protection

**Response:**
```json
{
  "success": true,
  "message": "OAuth authentication successful",
  "tokens": {
    "access_token": "ya29.a0AfH6SMB...",
    "refresh_token": "1//0gHr-xyz...",
    "expiry_date": 1702821600000
  }
}
```

#### 3. Fetch GAM Networks

**Endpoint:** `GET /google-ad-manager/networks`

Retrieve available GAM networks for the authenticated user.

**Request:**
```http
GET /api/google-ad-manager/networks HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "access_token": "ya29.a0AfH6SMB..."
}
```

**Response:**
```json
{
  "success": true,
  "networks": [
    {
      "network_code": "12345678",
      "network_name": "Example Publisher Network",
      "display_name": "Example Publisher",
      "time_zone": "America/New_York"
    }
  ]
}
```

---

## API Endpoints

### Connection Management

#### Add Data Source

**Endpoint:** `POST /google-ad-manager/add-data-source`

Create a new GAM data source connection with OAuth tokens and configuration.

**Request:**
```http
POST /api/google-ad-manager/add-data-source HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Main GAM Network",
  "network_code": "12345678",
  "network_id": "12345678",
  "network_name": "Main Network",
  "access_token": "ya29.a0AfH6SMB...",
  "refresh_token": "1//0gHr-xyz...",
  "token_expiry": "2025-12-17T15:30:00Z",
  "project_id": 1,
  "report_types": ["revenue", "inventory", "geography"],
  "start_date": "2025-11-16",
  "end_date": "2025-12-16",
  "sync_frequency": "daily"
}
```

**Request Validation:**
- `name`: Required, non-empty string
- `network_code`: Required
- `network_id`: Required
- `access_token`: Required
- `refresh_token`: Required
- `token_expiry`: Required
- `project_id`: Required, positive integer
- `report_types`: Required array with at least 1 report type
- `sync_frequency`: Optional, one of: hourly, daily, weekly, manual

**Response (201 Created):**
```json
{
  "success": true,
  "data_source_id": 42,
  "message": "Google Ad Manager data source added successfully"
}
```

#### List Networks

**Endpoint:** `POST /google-ad-manager/networks`

List all accessible Google Ad Manager networks for the authenticated user.

**Request:**
```http
POST /api/google-ad-manager/networks HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "access_token": "ya29.a0AfH6SMB..."
}
```

**Response:**
```json
{
  "networks": [],
  "count": 0,
  "message": "Networks retrieved successfully"
}
```

#### Delete Data Source

**Endpoint:** `DELETE /google-ad-manager/data-source/:dataSourceId`

Delete a GAM data source and all associated data.

**Request:**
```http
DELETE /api/google-ad-manager/data-source/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Data source deleted successfully"
}
```

---

### Data Synchronization

#### Trigger Sync

**Endpoint:** `POST /google-ad-manager/sync/:dataSourceId`

Manually trigger a data sync for a GAM data source.

**Request:**
```http
POST /api/google-ad-manager/sync/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
- `dataSourceId`: Data source ID (positive integer)

**Request Body:** Empty ({})

**Response:**
```json
{
  "success": true,
  "message": "Sync completed successfully"
}
```

#### Get Sync Status

**Endpoint:** `GET /google-ad-manager/sync-status/:dataSourceId`

Check the sync status and history for a GAM data source.

**Request:**
```http
GET /api/google-ad-manager/sync-status/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "last_sync": "2025-12-16T15:04:32Z",
  "sync_history": [
    {
      "data_source_id": 42,
      "synced_at": "2025-12-16T15:04:32Z",
      "status": "success"
    },
    {
      "data_source_id": 42,
      "synced_at": "2025-12-15T14:00:00Z",
      "status": "success"
    }
  ],
  "message": "Sync status retrieved successfully"
}
```

**Request:**
```http
GET /api/google-ad-manager/sync/42/history?limit=20&status=completed HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of records (default: 50)
- `status` (optional): Filter by status
- `start_date` (optional): Filter from date
- `end_date` (optional): Filter to date

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "sync_abc123xyz",
      "status": "completed",
      "started_at": "2025-12-16T15:00:00Z",
      "completed_at": "2025-12-16T15:04:32Z",
      "records_synced": 45230,
      "duration_seconds": 272
    },
    {
      "id": "sync_def456uvw",
      "status": "completed",
      "started_at": "2025-12-16T14:00:00Z",
      "completed_at": "2025-12-16T14:03:15Z",
      "records_synced": 43100,
      "duration_seconds": 195
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

---

### Advanced Sync Configuration

#### Update Advanced Configuration

**Endpoint:** `PUT /google-ad-manager/connections/:id/advanced-config`

Configure advanced sync settings including scheduling.

**Request:**
```http
PUT /api/google-ad-manager/connections/42/advanced-config HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "advanced_sync_config": {
    "frequency": {
      "type": "hourly"
    },
    "date_range_preset": "last_30_days",
    "dimensions": {
      "include": ["date", "ad_unit_id", "ad_unit_name", "country"],
      "exclude": []
    },
    "metrics": {
      "include": ["total_earnings", "impressions", "clicks", "ctr", "ecpm"],
      "exclude": []
    },
    "filters": {
      "ad_unit_name": {
        "contains": "Homepage"
      },
      "country": {
        "in": ["US", "CA", "GB"]
      }
    },
    "validation": {
      "incremental_sync": true,
      "deduplication": true,
      "data_validation": true,
      "max_records": 1000000
    },
    "notifications": {
      "notify_on_completion": true,
      "notify_on_failure": true,
      "email_recipients": ["admin@example.com"]
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Advanced configuration saved and scheduler updated",
  "data_source": {
    "id": 42,
    "api_config": {
      "advanced_sync_config": {
        "frequency": {
          "type": "hourly"
        }
      }
    }
  },
  "scheduler": {
    "job_created": true,
    "cron_expression": "0 * * * *",
    "next_run": "2025-12-16T16:00:00Z"
  }
}
```

---

### Scheduler Management

#### Get Scheduled Jobs

**Endpoint:** `GET /scheduler/jobs`

List all scheduled sync jobs.

**Request:**
```http
GET /api/scheduler/jobs HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "dataSourceId": 42,
      "dataSourceName": "Main GAM Network",
      "schedule": "0 * * * *",
      "frequency": "hourly",
      "status": "active",
      "nextRun": "2025-12-16T16:00:00Z",
      "lastRun": "2025-12-16T15:00:00Z",
      "runCount": 125
    }
  ]
}
```

#### Get Specific Job

**Endpoint:** `GET /scheduler/jobs/:dataSourceId`

Get details for a specific scheduled job.

**Request:**
```http
GET /api/scheduler/jobs/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "job": {
    "dataSourceId": 42,
    "dataSourceName": "Main GAM Network",
    "schedule": "0 * * * *",
    "frequency": "hourly",
    "status": "active",
    "nextRun": "2025-12-16T16:00:00Z",
    "lastRun": "2025-12-16T15:00:00Z",
    "runCount": 125,
    "connectionDetails": {
      "network_code": "12345678",
      "report_types": ["revenue", "inventory"]
    }
  }
}
```

#### Schedule Job

**Endpoint:** `POST /scheduler/jobs/:dataSourceId`

Create or update a scheduled sync job.

**Request:**
```http
POST /api/scheduler/jobs/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "frequency": "daily",
  "report_types": ["revenue", "inventory", "geography"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job scheduled successfully",
  "job": {
    "dataSourceId": 42,
    "schedule": "0 0 * * *",
    "frequency": "daily",
    "status": "active",
    "nextRun": "2025-12-17T00:00:00Z"
  }
}
```

#### Update Job Schedule

**Endpoint:** `PUT /scheduler/jobs/:dataSourceId`

Update the schedule for an existing job.

**Request:**
```http
PUT /api/scheduler/jobs/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "frequency": "hourly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule updated successfully",
  "job": {
    "dataSourceId": 42,
    "schedule": "0 * * * *",
    "frequency": "hourly",
    "nextRun": "2025-12-16T16:00:00Z"
  }
}
```

#### Pause Job

**Endpoint:** `POST /scheduler/jobs/:dataSourceId/pause`

Pause a scheduled job temporarily.

**Request:**
```http
POST /api/scheduler/jobs/42/pause HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job paused successfully",
  "job": {
    "dataSourceId": 42,
    "status": "paused"
  }
}
```

#### Resume Job

**Endpoint:** `POST /scheduler/jobs/:dataSourceId/resume`

Resume a paused job.

**Request:**
```http
POST /api/scheduler/jobs/42/resume HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job resumed successfully",
  "job": {
    "dataSourceId": 42,
    "status": "active",
    "nextRun": "2025-12-16T16:00:00Z"
  }
}
```

#### Cancel Job

**Endpoint:** `DELETE /scheduler/jobs/:dataSourceId`

Cancel and remove a scheduled job.

**Request:**
```http
DELETE /api/scheduler/jobs/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

#### Trigger Job Manually

**Endpoint:** `POST /scheduler/jobs/:dataSourceId/trigger`

Execute a job immediately, bypassing the schedule.

**Request:**
```http
POST /api/scheduler/jobs/42/trigger HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job triggered successfully",
  "sync_id": "sync_ghi789rst"
}
```

#### Get Scheduler Statistics

**Endpoint:** `GET /scheduler/stats`

Get overall scheduler health and statistics.

**Request:**
```http
GET /api/scheduler/stats HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalJobs": 15,
    "activeJobs": 12,
    "pausedJobs": 3,
    "totalRuns": 3450
  }
}
```

---

### Data Export

#### Generate Export

**Endpoint:** `POST /google-ad-manager/export/:id`

Generate a data export in CSV, Excel, or JSON format.

**Request:**
```http
POST /api/google-ad-manager/export/42 HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "format": "csv",
  "report_type": "revenue",
  "date_range": {
    "start": "2025-12-01",
    "end": "2025-12-16"
  },
  "fields": ["date", "ad_unit_name", "total_earnings", "impressions", "ecpm"],
  "filters": {
    "country": ["US", "CA"]
  }
}
```

**Request Body:**
- `format` (required): `csv`, `excel`, or `json`
- `report_type` (required): Report type to export
- `date_range` (optional): Date range filter
- `fields` (optional): Specific fields to include
- `filters` (optional): Dimension filters

**Response:**
```json
{
  "success": true,
  "message": "Export generated successfully",
  "export": {
    "id": "export_jkl012mno",
    "format": "csv",
    "file_size": 2458624,
    "record_count": 45230,
    "download_url": "/api/google-ad-manager/export/42/download/export_jkl012mno",
    "expires_at": "2025-12-23T15:00:00Z"
  }
}
```

#### Download Export

**Endpoint:** `GET /google-ad-manager/export/:id/download/:exportId`

Download a generated export file.

**Request:**
```http
GET /api/google-ad-manager/export/42/download/export_jkl012mno HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
- Content-Type: `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, or `application/json`
- Content-Disposition: `attachment; filename="gam_revenue_20251216.csv"`
- Body: File data

#### Get Export History

**Endpoint:** `GET /google-ad-manager/export/:id/history`

List past exports for a connection.

**Request:**
```http
GET /api/google-ad-manager/export/42/history HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "exports": [
    {
      "id": "export_jkl012mno",
      "format": "csv",
      "report_type": "revenue",
      "file_size": 2458624,
      "created_at": "2025-12-16T15:00:00Z",
      "download_url": "/api/google-ad-manager/export/42/download/export_jkl012mno",
      "expires_at": "2025-12-23T15:00:00Z"
    }
  ]
}
```

---

### Dashboard & Analytics

#### Get Dashboard Statistics

**Endpoint:** `GET /google-ad-manager/dashboard/:id/stats`

Get aggregated statistics for dashboard display.

**Request:**
```http
GET /api/google-ad-manager/dashboard/42/stats HTTP/1.1
Host: localhost:3002
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "revenue": {
      "today": 1250.50,
      "yesterday": 1180.25,
      "this_month": 38500.75,
      "last_month": 35200.00,
      "growth_pct": 9.38
    },
    "impressions": {
      "today": 450000,
      "yesterday": 420000,
      "this_month": 13500000,
      "last_month": 12800000
    },
    "top_ad_units": [
      {
        "name": "Homepage - ATF",
        "revenue": 8500.50,
        "impressions": 2500000
      }
    ],
    "top_countries": [
      {
        "country": "US",
        "revenue": 25000.00,
        "impressions": 8000000
      }
    ]
  }
}
```

---

## Request/Response Formats

### Standard Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests (Rate Limited) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication failed |
| `INVALID_TOKEN` | JWT token invalid or expired |
| `OAUTH_ERROR` | OAuth flow error |
| `NETWORK_NOT_FOUND` | GAM network not found |
| `CONNECTION_EXISTS` | Connection already exists |
| `SYNC_IN_PROGRESS` | Sync already running |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `VALIDATION_ERROR` | Request validation failed |
| `DATABASE_ERROR` | Database operation failed |

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2025-12-16T16:00:00Z"
    }
  }
}
```

---

## Rate Limiting

### Limits

- **Global:** 1000 requests per hour per user
- **Sync Operations:** 10 concurrent syncs per connection
- **OAuth:** 100 requests per hour
- **Exports:** 50 exports per day per connection

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 750
X-RateLimit-Reset: 1702821600
```

### Handling Rate Limits

When rate limited (429 status):

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "retry_after": 3600
    }
  }
}
```

Implement exponential backoff:
```javascript
const delay = Math.min(1000 * Math.pow(2, attemptNumber), 30000);
await new Promise(resolve => setTimeout(resolve, delay));
```

---

## WebSocket Events

### Connecting to WebSocket

```javascript
const socket = io('http://localhost:3002', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Sync Progress Events

**Event:** `sync:progress`

Emitted during sync operations with real-time progress.

```javascript
socket.on('sync:progress', (data) => {
  console.log('Sync progress:', data);
});
```

**Payload:**
```json
{
  "sync_id": "sync_abc123xyz",
  "data_source_id": 42,
  "status": "running",
  "progress": 45,
  "current_report": "revenue",
  "records_synced": 20500,
  "estimated_completion": "2025-12-16T15:03:00Z"
}
```

### Sync Completion Events

**Event:** `sync:completed`

```javascript
socket.on('sync:completed', (data) => {
  console.log('Sync completed:', data);
});
```

**Payload:**
```json
{
  "sync_id": "sync_abc123xyz",
  "data_source_id": 42,
  "status": "completed",
  "records_synced": 45230,
  "duration_seconds": 272
}
```

### Sync Error Events

**Event:** `sync:error`

```javascript
socket.on('sync:error', (data) => {
  console.error('Sync error:', data);
});
```

**Payload:**
```json
{
  "sync_id": "sync_abc123xyz",
  "data_source_id": 42,
  "status": "failed",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "GAM API rate limit exceeded"
  }
}
```

---

## Code Examples

### JavaScript/Node.js

#### Create Connection

```javascript
const axios = require('axios');

const createGAMConnection = async (projectId, connectionData) => {
  try {
    const response = await axios.post(
      'http://localhost:3002/api/google-ad-manager/connections',
      {
        project_id: projectId,
        connection_name: connectionData.name,
        network_code: connectionData.networkCode,
        access_token: connectionData.accessToken,
        refresh_token: connectionData.refreshToken,
        token_expiry: connectionData.tokenExpiry,
        api_config: {
          report_types: ['revenue', 'inventory'],
          date_range: {
            start: '2025-11-16',
            end: '2025-12-16'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Connection created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating connection:', error.response.data);
    throw error;
  }
};
```

#### Trigger Sync

```javascript
const triggerSync = async (dataSourceId) => {
  try {
    const response = await axios.post(
      `http://localhost:3002/api/google-ad-manager/sync/${dataSourceId}`,
      {
        report_types: ['revenue', 'inventory'],
        incremental: true
      },
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      }
    );
    
    console.log('Sync started:', response.data.sync_id);
    return response.data;
  } catch (error) {
    console.error('Error triggering sync:', error.response.data);
    throw error;
  }
};
```

#### Monitor Sync with WebSocket

```javascript
const io = require('socket.io-client');

const monitorSync = (dataSourceId) => {
  const socket = io('http://localhost:3002', {
    auth: {
      token: jwtToken
    }
  });
  
  socket.on('connect', () => {
    console.log('Connected to WebSocket');
  });
  
  socket.on('sync:progress', (data) => {
    if (data.data_source_id === dataSourceId) {
      console.log(`Sync progress: ${data.progress}%`);
      console.log(`Records synced: ${data.records_synced}`);
    }
  });
  
  socket.on('sync:completed', (data) => {
    if (data.data_source_id === dataSourceId) {
      console.log('Sync completed!');
      console.log(`Total records: ${data.records_synced}`);
      socket.disconnect();
    }
  });
  
  socket.on('sync:error', (data) => {
    if (data.data_source_id === dataSourceId) {
      console.error('Sync failed:', data.error.message);
      socket.disconnect();
    }
  });
};
```

### Python

#### Create Connection

```python
import requests

def create_gam_connection(project_id, connection_data, jwt_token):
    url = 'http://localhost:3002/api/google-ad-manager/connections'
    
    payload = {
        'project_id': project_id,
        'connection_name': connection_data['name'],
        'network_code': connection_data['network_code'],
        'access_token': connection_data['access_token'],
        'refresh_token': connection_data['refresh_token'],
        'token_expiry': connection_data['token_expiry'],
        'api_config': {
            'report_types': ['revenue', 'inventory'],
            'date_range': {
                'start': '2025-11-16',
                'end': '2025-12-16'
            }
        }
    }
    
    headers = {
        'Authorization': f'Bearer {jwt_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 201:
        print('Connection created:', response.json())
        return response.json()
    else:
        print('Error:', response.json())
        raise Exception(response.json())
```

#### Trigger Sync

```python
def trigger_sync(data_source_id, jwt_token):
    url = f'http://localhost:3002/api/google-ad-manager/sync/{data_source_id}'
    
    payload = {
        'report_types': ['revenue', 'inventory'],
        'incremental': True
    }
    
    headers = {
        'Authorization': f'Bearer {jwt_token}'
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        sync_data = response.json()
        print('Sync started:', sync_data['sync_id'])
        return sync_data
    else:
        print('Error:', response.json())
        raise Exception(response.json())
```

### cURL

#### Create Connection

```bash
curl -X POST http://localhost:3002/api/google-ad-manager/connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "connection_name": "Main GAM Network",
    "network_code": "12345678",
    "access_token": "ya29.a0AfH6SMB...",
    "refresh_token": "1//0gHr-xyz...",
    "token_expiry": 1702821600000,
    "api_config": {
      "report_types": ["revenue", "inventory"],
      "date_range": {
        "start": "2025-11-16",
        "end": "2025-12-16"
      }
    }
  }'
```

#### Trigger Sync

```bash
curl -X POST http://localhost:3002/api/google-ad-manager/sync/42 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_types": ["revenue", "inventory"],
    "incremental": true
  }'
```

#### Get Sync Status

```bash
curl -X GET http://localhost:3002/api/google-ad-manager/sync/42/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## SDK Integration

### TypeScript SDK (Recommended)

```typescript
import { GAMClient } from '@dataresearchanalysis/sdk';

const client = new GAMClient({
  baseUrl: 'http://localhost:3002',
  apiKey: 'your_jwt_token'
});

// Create connection
const connection = await client.connections.create({
  projectId: 1,
  connectionName: 'Main GAM Network',
  networkCode: '12345678',
  accessToken: 'ya29.a0AfH6SMB...',
  refreshToken: '1//0gHr-xyz...',
  tokenExpiry: 1702821600000,
  apiConfig: {
    reportTypes: ['revenue', 'inventory'],
    dateRange: {
      start: '2025-11-16',
      end: '2025-12-16'
    }
  }
});

// Trigger sync
const sync = await client.sync.trigger(connection.id, {
  reportTypes: ['revenue', 'inventory'],
  incremental: true
});

// Monitor sync
client.sync.on('progress', (data) => {
  console.log(`Progress: ${data.progress}%`);
});

client.sync.on('completed', (data) => {
  console.log('Sync completed!');
});
```

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Maintained By:** Data Research Analysis Team

