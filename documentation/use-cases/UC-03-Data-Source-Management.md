# UC-03 — Data Source Management

**Domain:** Data Source Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner** | Primary Human | Full control over data sources |
| **Project Member (Editor+)** | Primary Human | Can add and manage data sources per RBAC |
| **OAuth Provider** | Secondary System | Google (GA4, Ads, Ad Manager), LinkedIn, Meta |
| **External Database** | Secondary System | PostgreSQL, MySQL, MariaDB, MongoDB |
| **File System** | Secondary System | File storage for CSV, Excel, PDF uploads |
| **Multer** | Secondary System | File upload middleware; enforces MIME and size limits |
| **Tier Enforcement** | Secondary System | `enforceDataSourceLimit` — subscription data source cap |
| **Encryption Service** | Secondary System | AES encrypt/decrypt on `connection_details` field |
| **RBAC Middleware** | Secondary System | `requireProjectPermission`, `requireDataSourcePermission` |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|             Data Source Management                        |
|                                                           |
|  UC-DS-01   Test Database Connection                     |
|  UC-DS-02   Connect Relational Database (PG/MySQL/Maria) |
|  UC-DS-03   Connect MongoDB                              |
|  UC-DS-04   Upload CSV File                              |
|  UC-DS-05   Upload Excel File                            |
|  UC-DS-06   Upload PDF File                              |
|  UC-DS-07   Connect Google Analytics 4                   |
|  UC-DS-08   Connect Google Ads                           |
|  UC-DS-09   Connect Google Ad Manager                    |
|  UC-DS-10   Connect LinkedIn Ads                         |
|  UC-DS-11   Connect Meta Ads                             |
|  UC-DS-12   List Data Sources                            |
|  UC-DS-13   View Data Source Schema / Preview            |
|  UC-DS-14   Refresh Data Source                          |
|  UC-DS-15   Delete Data Source                           |
+-----------------------------------------------------------+

Project Owner / Editor ---> UC-DS-01 through UC-DS-15
OAuth Provider <----------- UC-DS-07, UC-DS-08, UC-DS-09,
                            UC-DS-10, UC-DS-11
External Database <-------- UC-DS-01, UC-DS-02, UC-DS-03
File System <-------------- UC-DS-04, UC-DS-05, UC-DS-06

<<include>>:
  UC-DS-02 <<include>> UC-DS-01 (test connection before save)
  UC-DS-03 <<include>> UC-DS-01
  UC-DS-02 <<include>> Enforce Data Source Tier Limit
  UC-DS-05 <<include>> Validate File Type and Size
  UC-DS-09 <<include>> OAuth Authorisation Flow

<<extend>>:
  UC-DS-02 <<extend>> Auto-encrypt Connection Details
  UC-DS-05 <<extend>> Async Large-File Processing
```

---

## UC-DS-01 — Test Database Connection

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-01 |
| **Use Case Name** | Test Database Connection |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | External Database |
| **Priority** | Critical |
| **Trigger** | User clicks "Test Connection" on data source form; `POST /data-sources/test-connection` |
| **Preconditions** | User is authenticated. Connection parameters provided. |
| **Postconditions (Success)** | HTTP 200: connection confirmed; no record persisted. |
| **Postconditions (Failure)** | HTTP 400; connection refused or timed out. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Fills in `data_source_type`, `host`, `port`, `database_name`, `username`, `password` (or `connection_string` for MongoDB). |
| 2 | System | Validates JWT. |
| 3 | System | Validates required fields per data source type. |
| 4 | System | Constructs `IDBConnectionDetails` object. |
| 5 | System | `DataSourceProcessor.connectToDataSource()` attempts live connection. |
| 6 | System | HTTP 200: *"The data source has been connected."* |

### Alternative Flows

**ALT-DS01A — Missing Required Fields (non-MongoDB)**
- At step 3: HTTP 400: *"Please provide all connection fields (host, port, database_name, username, password)."*

**ALT-DS01B — MongoDB Missing Connection String**
- At step 3: HTTP 400: *"MongoDB requires a connection_string…"*

**ALT-DS01C — Connection Refused / Timeout**
- At step 5: HTTP 400: *"The data source could not be connected."*

**ALT-DS01D — Invalid Credentials**
- At step 5: authentication error from external DB; HTTP 400.

### Business Rules
- BR-DS-01: Connection test does not persist any data.
- BR-DS-02: For MongoDB, a connection string is mandatory; individual host/port fields are optional.

---

## UC-DS-02 — Connect Relational Database (PostgreSQL / MySQL / MariaDB)

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-02 |
| **Use Case Name** | Connect Relational Database |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | External Database, Tier Enforcement, Encryption Service |
| **Priority** | Critical |
| **Trigger** | User submits connection form: `POST /data-sources/add-data-source` |
| **Preconditions** | 1. User authenticated. 2. Data source tier limit not reached. 3. User has `CREATE` permission on project. |
| **Postconditions (Success)** | Data source record created in `dra_data_sources` with encrypted `connection_details`. Schema introspected and cached. |
| **Postconditions (Failure)** | No record created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects DB type (PostgreSQL / MySQL / MariaDB); enters host, port, schema, database, username, password; submits. |
| 2 | System | Validates JWT. |
| 3 | System | `enforceDataSourceLimit` checks tier cap. |
| 4 | System | Validates fields; constructs `IDBConnectionDetails`. |
| 5 | System | `requireProjectPermission(CREATE)` verifies RBAC. |
| 6 | System | Calls `DataSourceProcessor.connectToDataSource()` — live connection test. |
| 7 | System | On success: calls `DataSourceProcessor.addDataSource()` — persists record; TypeORM `ValueTransformer` auto-encrypts `connection_details`. |
| 8 | System | HTTP 200: *"The data source has been connected."* |
| 9 | Client | Adds data source to Pinia store; syncs localStorage. |

### Alternative Flows

**ALT-DS02A — Tier Limit Reached**
- At step 3: HTTP 403 with upgrade prompt.

**ALT-DS02B — Connection Test Fails**
- At step 6: HTTP 400; record not saved.

**ALT-DS02C — Insufficient Permission**
- At step 5: HTTP 403.

### Business Rules
- BR-DS-03: `connection_details` is auto-encrypted at rest via TypeORM `ValueTransformer`.
- BR-DS-04: Connection must be verified live before persistence.
- BR-DS-05: Data source creation respects subscription tier caps.

---

## UC-DS-03 — Connect MongoDB

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-03 |
| **Use Case Name** | Connect MongoDB |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User selects MongoDB type and provides `connection_string`; `POST /data-sources/add-data-source` |
| **Preconditions** | Same as UC-DS-02. |
| **Postconditions (Success)** | MongoDB data source persisted with `schema = 'dra_mongodb'` (synthetic). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "MongoDB"; enters `connection_string` (e.g., `mongodb+srv://...`). |
| 2–7 | System | Same as UC-DS-02 steps 2–7, with `schema` auto-set to `'dra_mongodb'`. |
| 8 | System | HTTP 200 confirmation. |

---

## UC-DS-04 — Upload CSV File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-04 |
| **Use Case Name** | Upload CSV File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer |
| **Trigger** | User uploads `.csv` file on data source connect page |
| **Preconditions** | User authenticated; file ≤ 500 MB; MIME: `text/csv` or `application/csv`. |
| **Postconditions (Success)** | CSV parsed; data source record created; data stored in backend. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "CSV" and chooses file; submits via multipart form. |
| 2 | System | `excelUpload` multer validates MIME (`text/csv`) and extension (`.csv`); file size ≤ 500 MB. |
| 3 | System | File saved to `public/uploads/excel/` with timestamped name. |
| 4 | System | `ExcelFileService` parses CSV; extracts headers and rows. |
| 5 | System | Data source record persisted; data populated. |
| 6 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-DS04A — Invalid File Type**
- At step 2: Multer `fileFilter` rejects; HTTP 400: *"Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed."*

**ALT-DS04B — File Exceeds 500 MB**
- At step 2: HTTP 413.

**ALT-DS04C — Parse Error (malformed CSV)**
- At step 4: HTTP 400 with parse error message.

---

## UC-DS-05 — Upload Excel File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-05 |
| **Use Case Name** | Upload Excel File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer, ExcelFileService |
| **Priority** | High |
| **Trigger** | User uploads `.xlsx` or `.xls` file |
| **Preconditions** | File ≤ 500 MB; MIME: `application/vnd.ms-excel` or OOXML. |
| **Postconditions (Success)** | Excel data parsed; data source created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects Excel type; selects file; submits. |
| 2 | System | Multer validates type/size; saves with `{timestamp}_{sanitisedName}`. |
| 3 | System | `ExcelFileService` reads workbook; extracts sheets/columns/rows. |
| 4 | System | For large files (async path): job queued; immediate acknowledgement returned. |
| 5 | System | On completion: data source record persisted; user notified via notification. |

### Alternative Flows

**ALT-DS05A — File Too Large (> 500 MB)**
- HTTP 413.

**ALT-DS05B — Corrupted Excel File**
- At step 3: parse error; HTTP 400.

**ALT-DS05C — Large File Async Failure**
- Job fails in queue; error logged; notification sent to user.

### Business Rules
- BR-DS-06: Filenames are sanitised (non-alphanumeric chars replaced with `_`) to prevent path traversal.
- BR-DS-07: Large Excel files are processed asynchronously via job queue.

---

## UC-DS-06 — Upload PDF File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-06 |
| **Use Case Name** | Upload PDF File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer, PDFService |
| **Trigger** | User uploads `.pdf` file |
| **Postconditions (Success)** | PDF text extracted; data source created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "PDF"; uploads file via `upload` (pdf multer config). |
| 2 | System | File saved to `public/uploads/pdfs/` (original filename preserved). |
| 3 | System | `PDFService` extracts text content and structures it. |
| 4 | System | Data source record persisted. |

### Alternative Flows

**ALT-DS06A — Encrypted PDF**
- At step 3: extraction fails; HTTP 400.

**ALT-DS06B — Non-PDF File**
- Multer rejects; HTTP 400.

---

## UC-DS-07 — Connect Google Analytics 4

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-07 |
| **Use Case Name** | Connect Google Analytics 4 |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates GA4 OAuth flow from connect page |
| **Postconditions (Success)** | GA4 data source created; OAuth tokens encrypted and stored. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "Google Analytics 4"; clicks "Connect with Google". |
| 2 | System | Redirects to Google OAuth with GA4 scopes. |
| 3 | Google | Returns authorisation code to `/oauth/callback`. |
| 4 | System | Exchanges code for access + refresh tokens. |
| 5 | System | Fetches available GA4 properties from Google API. |
| 6 | User | Selects property; confirms. |
| 7 | System | Persists data source with encrypted tokens. |

### Alternative Flows

**ALT-DS07A — OAuth Denied by User**
- At step 3: redirect back with `error=access_denied`.

**ALT-DS07B — Token Exchange Failure**
- At step 4: HTTP 400; user prompted to retry.

**ALT-DS07C — No GA4 Properties Found**
- At step 5: HTTP 400: *"No GA4 properties found for this account."*

---

## UC-DS-08 — Connect Google Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-08 |
| **Use Case Name** | Connect Google Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates Google Ads OAuth flow |
| **Postconditions (Success)** | Google Ads data source created with developer token and OAuth tokens stored encrypted. |

### Main Success Scenario (same OAuth flow as UC-DS-07 with Google Ads scopes and Manager Account selection)

### Alternative Flows

**ALT-DS08A — Manager Account Limitation**
- Certain developer tokens only allow access to test accounts; HTTP 400 with explanation.

**ALT-DS08B — No Ads Accounts Found**
- HTTP 400: *"No Google Ads accounts found."*

---

## UC-DS-09 — Connect Google Ad Manager

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-09 |
| **Use Case Name** | Connect Google Ad Manager |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates Google Ad Manager OAuth flow from `/data-sources/connect/google-ad-manager` |
| **Postconditions (Success)** | Ad Manager data source created; network codes and encrypted tokens stored. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "Google Ad Manager"; clicks connect. |
| 2 | System | Initiates OAuth with Ad Manager API scopes. Rate limited by `google_ad_manager_rate_limit`. |
| 3 | Google | Returns authorisation code. |
| 4 | System | Exchanges for tokens; fetches available networks. |
| 5 | User | Selects AdManager network. |
| 6 | System | Stores data source record with encrypted credentials. |

### Alternative Flows

**ALT-DS09A — Rate Limit Hit on Ad Manager API**
- `google_ad_manager_rate_limit` returns HTTP 429.

---

## UC-DS-10 — Connect LinkedIn Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-10 |
| **Use Case Name** | Connect LinkedIn Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (LinkedIn) |
| **Trigger** | User initiates LinkedIn OAuth flow |
| **Postconditions (Success)** | LinkedIn Ads data source created with OAuth tokens stored encrypted. |

### Alternative Flows

**ALT-DS10A — LinkedIn OAuth Denied** → redirect to connect page with error.

**ALT-DS10B — No Ad Accounts on LinkedIn Account** → HTTP 400.

---

## UC-DS-11 — Connect Meta Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-11 |
| **Use Case Name** | Connect Meta Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Meta / Facebook) |
| **Trigger** | User initiates Meta OAuth flow |
| **Postconditions (Success)** | Meta Ads data source created. |

### Alternative Flows

**ALT-DS11A — Meta OAuth Denied** → redirect with error.

**ALT-DS11B — No Ad Accounts** → HTTP 400.

---

## UC-DS-12 — List Data Sources

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-12 |
| **Use Case Name** | List Data Sources |
| **Primary Actor** | Registered User |
| **Trigger** | `GET /data-sources/list` |
| **Postconditions (Success)** | Array of data sources (with decrypted connection_details) returned for authorised user. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /data-sources/list` with JWT. |
| 2 | System | `DataSourceProcessor.getDataSources()` queries by user/project membership. |
| 3 | System | TypeORM `ValueTransformer` auto-decrypts `connection_details` on read. |
| 4 | System | Returns array. |

---

## UC-DS-13 — View Data Source Schema / Preview

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-13 |
| **Use Case Name** | View Data Source Schema / Preview |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User clicks on a data source to view its schema; `GET /data-sources/schema/:data_source_id` |
| **Postconditions (Success)** | Table/column list with data types returned. |

### Alternative Flows

**ALT-DS13A — Source Unreachable**
- Live schema fetch fails; cached schema returned if available; otherwise HTTP 400.

---

## UC-DS-14 — Refresh Data Source

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-14 |
| **Use Case Name** | Refresh Data Source |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /data-sources/refresh/:data_source_id` |
| **Postconditions (Success)** | Schema re-introspected; new data fetched from external source. |

### Alternative Flows

**ALT-DS14A — External Source Unavailable**
- HTTP 400; last-known data retained.

---

## UC-DS-15 — Delete Data Source

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-15 |
| **Use Case Name** | Delete Data Source |
| **Primary Actor** | Project Owner |
| **Trigger** | `DELETE /data-sources/delete/:data_source_id` |
| **Preconditions** | Actor has delete permission via RBAC. |
| **Postconditions (Success)** | Data source record and associated files deleted. Any dependent data models flagged as broken. |

### Alternative Flows

**ALT-DS15A — Data Source Has Dependent Data Models**
- Dependent models set to `broken` state; user warned of impact before confirmation.

**ALT-DS15B — Insufficient Permission**
- HTTP 403.
