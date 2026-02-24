# UC-07 — Data Quality

**Domain:** Data Quality  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Initiates quality checks and applies cleaning rules |
| **Project Viewer** | Primary Human | Read-only access to quality reports |
| **DataQualityProcessor** | Secondary System | Singleton processor for all quality analysis operations |
| **RBAC Middleware** | Secondary System | `authorize(DATA_MODEL_VIEW)` and `authorize(DATA_MODEL_EDIT)` |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                    Data Quality                           |
|                                                           |
|  UC-DQ-01  Analyse Data Model (Generate Quality Report)  |
|  UC-DQ-02  Apply Cleaning Rules to Data Model            |
|  UC-DQ-03  View Latest Quality Report                    |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-DQ-01, UC-DQ-02, UC-DQ-03
Project Viewer -----------> UC-DQ-03

<<include>>:
  UC-DQ-01 <<include>> RBAC Permission Check (VIEW)
  UC-DQ-02 <<include>> RBAC Permission Check (EDIT)
  UC-DQ-02 <<include>> Validate Cleaning Configuration

<<extend>>:
  UC-DQ-01 <<extend>> Flag Data Quality Issues
```

---

## UC-DQ-01 — Analyse Data Model (Generate Quality Report)

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-01 |
| **Use Case Name** | Analyse Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DataQualityProcessor |
| **Priority** | High |
| **Trigger** | `POST /data-quality/analyze/:data_model_id` |
| **Preconditions** | 1. User is authenticated. 2. User has `DATA_MODEL_VIEW` permission. 3. Data model exists and has data. |
| **Postconditions (Success)** | Quality report generated: completeness, accuracy metrics, null rates, anomalies, duplicate rates per column. |
| **Postconditions (Failure)** | HTTP 500 with error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to data quality tab for a data model; clicks "Run Quality Check". |
| 2 | Client | `POST /data-quality/analyze/:data_model_id`. |
| 3 | System | Validates JWT; `authorize(DATA_MODEL_VIEW)`. |
| 4 | System | Validates `data_model_id` (integer). |
| 5 | System | `DataQualityProcessor.analyzeDataModel()` — executes profiling queries: null rates, distinct counts, type mismatches, value distributions, duplicate detection, completeness scores. |
| 6 | System | Computes overall quality score. |
| 7 | System | Persists quality report. |
| 8 | System | Returns quality report JSON with per-column and overall metrics. |

### Alternative Flows

**ALT-DQ01A — Invalid Data Model ID**
- At step 4: HTTP 400: *"Invalid data model ID."*

**ALT-DQ01B — Empty Data Model (No Rows)**
- At step 5: quality check completes with 100% null rate; report indicates empty dataset.

**ALT-DQ01C — Unsupported Column Type**
- At step 5: column skipped for type-specific checks; noted in report as "skipped".

**ALT-DQ01D — Analysis Execution Error**
- At step 5: HTTP 500: *"Failed to analyze data model."*

### Business Rules
- BR-DQ-01: Quality analysis covers: null/missing value rates, duplicate detection, type consistency, value range outliers, and completeness scores.
- BR-DQ-02: Per-column metrics must be computed independently.
- BR-DQ-03: An overall quality score (0–100) is calculated as a weighted composite of individual metrics.

---

## UC-DQ-02 — Apply Cleaning Rules to Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-02 |
| **Use Case Name** | Apply Cleaning Rules to Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DataQualityProcessor |
| **Priority** | High |
| **Trigger** | `POST /data-quality/clean/:data_model_id` with cleaning configuration |
| **Preconditions** | 1. User has `DATA_MODEL_EDIT` permission. 2. `cleaningConfig` object provided. 3. A quality report exists (UC-DQ-01 run first). |
| **Postconditions (Success)** | Cleaning rules applied; data model updated; new quality report generated. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Reviews quality report; selects cleaning rules (e.g., fill nulls with median, remove duplicates, standardise date formats). |
| 2 | Client | `POST /data-quality/clean/:data_model_id` with `{ cleaningConfig: { rules: [...] } }`. |
| 3 | System | Validates JWT; `authorize(DATA_MODEL_EDIT)`. |
| 4 | System | Validates `data_model_id` (integer). |
| 5 | System | Validates `cleaningConfig` object (required). |
| 6 | System | Merges `dataModelId` into config; `DataQualityProcessor.applyCleaningRules()` — executes cleaning transforms. |
| 7 | System | Returns updated quality metrics. |

### Alternative Flows

**ALT-DQ02A — Missing cleaningConfig**
- At step 5: HTTP 400: *"Cleaning configuration is required."*

**ALT-DQ02B — Invalid Rule in Configuration**
- At step 6: individual rule fails validation; rule skipped; remainder applied; partial report returned.

**ALT-DQ02C — Insufficient Permission**
- HTTP 403.

### Business Rules
- BR-DQ-04: Cleaning rules are non-destructive on source data; they transform the data model layer only.
- BR-DQ-05: A new quality report is automatically generated after cleaning.

---

## UC-DQ-03 — View Latest Quality Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-03 |
| **Use Case Name** | View Latest Quality Report |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | `GET /data-quality/report/:data_model_id/latest` |
| **Preconditions** | User authenticated; at least one quality report exists for the model. |
| **Postconditions (Success)** | Most recent quality report returned and rendered. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens data quality view for a data model. |
| 2 | Client | `GET /data-quality/report/:data_model_id/latest`. |
| 3 | System | Validates JWT; validates `data_model_id`. |
| 4 | System | Fetches most recently generated report. |
| 5 | System | Returns report JSON. |
| 6 | Client | Renders per-column quality cards, overall score, and recommendations. |

### Alternative Flows

**ALT-DQ03A — No Report Generated Yet**
- HTTP 404: *"No quality report found."* Client prompts user to run analysis first.
