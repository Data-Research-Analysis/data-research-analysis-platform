# Data Research Analysis — Architecture Documentation

This directory contains the authoritative architecture documentation for the Data Research Analysis (DRA) platform. It supersedes the early-stage architecture notes and reflects the current codebase (Nuxt 3 + Express + PostgreSQL + Redis + Gemini + Paddle).

## Document set

| # | Document | Scope |
|---|---|---|
| 00 | [System Overview](00-system-overview.md) | Product context, technology stack, deployment topology, high-level component diagram |
| 01 | [Backend Architecture](01-backend-architecture.md) | Layering (routes → controllers → processors → services → drivers), startup lifecycle, middleware pipeline, 45 processors, 122 services, 19 drivers |
| 02 | [Frontend Architecture](02-frontend-architecture.md) | Nuxt 3 SSR app, 23 Pinia stores, 91 composables, global middleware pipeline, plugins, lazy component strategy |
| 03 | [Data Architecture](03-data-architecture.md) | 77 TypeORM entities, tenancy hierarchy (org → workspace → project), migrations, schema conventions, medallion layers, refresh/health/quality |
| 04 | [Authentication & RBAC](04-authentication-rbac.md) | JWT, SAML SSO, OAuth, org/workspace/project role model, permission matrix, tier enforcement |
| 05 | [Billing & Subscriptions](05-billing-subscription.md) | Paddle checkout/webhooks, 5-tier ladder, lifecycle states, grace periods, promo codes, account cancellation |
| 06 | [AI & Plan Studio](06-ai-plan-studio.md) | Gemini integration, 18-step paid-media plan pipeline, skill registry, execution engine, AI usage/cost tracking |
| 07 | [Integrations](07-integrations.md) | 14 data-source types, Google/Meta/LinkedIn/HubSpot/Klaviyo connectors, sync architecture, gating |
| 08 | [Background Jobs & Queues](08-background-jobs.md) | 7 cron jobs, theta-mn-queue (7 queues), worker threads, schedulers, refresh queue |
| 09 | [Security](09-security.md) | AES-256-GCM encryption, rate limiting, input validation, SQLi/XSS protection, GDPR/cookie consent, data deletion |
| 10 | [Deployment & Observability](10-deployment-observability.md) | Docker topology, Jenkins CI, PM2, environment config, logging, performance metrics |

## UML diagrams

The `.puml` files in this directory are PlantUML sources; rendered `.png` versions sit alongside. Render with:

```
plantuml -tpng diagram.puml
# or, without a local JVM/PlantUML install:
docker run --rm -v "$PWD/documentation/architecture:/data" plantuml/plantuml:latest -tpng /data/<file>.puml
```

Current diagram inventory:

| Diagram | Covers |
|---|---|
| [backend-models-class-diagram.puml](backend-models-class-diagram.puml) | Core TypeORM entity groups and relationships |
| [services-architecture-class-diagram.puml](services-architecture-class-diagram.puml) | Service layer + processor architecture |
| [frontend-components-class-diagram.puml](frontend-components-class-diagram.puml) | Pinia stores, composables, middleware |
| [request-pipeline-sequence-diagram.puml](request-pipeline-sequence-diagram.puml) | End-to-end authenticated request flow with tenancy + tier middleware |
| [tenancy-hierarchy-class-diagram.puml](tenancy-hierarchy-class-diagram.puml) | Organization → Workspace → Project → resource hierarchy |
| [plan-execution-engine-sequence-diagram.puml](plan-execution-engine-sequence-diagram.puml) | Paid-media plan step execution with gates |
| [authentication-activity-diagram.puml](authentication-activity-diagram.puml) | Register / verify / login flow |
| [api-integration-sequence-diagram.puml](api-integration-sequence-diagram.puml) | General API lifecycle with auth + cascade deletion |
| [subscription-billing-sequence-diagram.puml](subscription-billing-sequence-diagram.puml) | Paddle checkout + webhook lifecycle |
| [google-oauth-data-sources-sequence-diagram.puml](google-oauth-data-sources-sequence-diagram.puml) | Google OAuth connect + sync |
| [realtime-communication-sequence-diagram.puml](realtime-communication-sequence-diagram.puml) | Socket.IO channels |
| [cascade-deletion-sequence-diagram.puml](cascade-deletion-sequence-diagram.puml) | Project/data-source/data-model deletion |
| [account-cancellation-sequence-diagram.puml](account-cancellation-sequence-diagram.puml) | Account cancellation + retention |
| [ai-data-modeler-sequence-diagram.puml](ai-data-modeler-sequence-diagram.puml) | AI data modeler chat sessions |
| [ai-insights-sequence-diagram.puml](ai-insights-sequence-diagram.puml) | AI insights generation |
| [attribution-sequence-diagram.puml](attribution-sequence-diagram.puml) | Attribution engine |
| [data-quality-sequence-diagram.puml](data-quality-sequence-diagram.puml) | Data quality analysis |
| [data-manipulation-sequence-diagram.puml](data-manipulation-sequence-diagram.puml) | Data model/dashboard manipulation |
| [database-backup-restore-sequence-diagram.puml](database-backup-restore-sequence-diagram.puml) | Scheduled backups |
| [notifications-sequence-diagram.puml](notifications-sequence-diagram.puml) | Notification delivery |
| [project-members-invitations-sequence-diagram.puml](project-members-invitations-sequence-diagram.puml) | Member invitations |
| [mongodb-integration-sequence-diagram.puml](mongodb-integration-sequence-diagram.puml) | MongoDB import |
| [excel-pdf-data-manipulation-activity-diagram.puml](excel-pdf-data-manipulation-activity-diagram.puml) | File upload processing |
| [pdf-processing-activity-diagram.puml](pdf-processing-activity-diagram.puml) | PDF OCR pipeline |

## Accuracy notes

- Counts and component names in these documents were verified against the codebase on 2026-10-22.
- Where the implementation diverges from older documentation (e.g. medallion enum values, AES-256-GCM vs CBC), the code is authoritative and the docs here reflect code.
- Known inconsistencies and dormant code are called out inline in each document.
- Point-in-time implementation notes, phase plans, and superseded references were removed on 2026-10-22; see the [documentation index](../README.md#removed-documents-2026-10-22). Completed work is recorded in [`CHANGELOG.md`](../../CHANGELOG.md).
