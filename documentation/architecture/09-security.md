# 09 — Security

## Encryption (`EncryptionService`)

- **AES-256-GCM** via Node `crypto` (the older docs' "AES-256-CBC" is wrong; GCM is the code's algorithm).
- Key from `ENCRYPTION_KEY` env — exactly 64 hex chars (32 bytes), validated at construction with a fail-fast at boot (`process.exit(1)` on invalid key).
- Random 16-byte IV per encryption + 16-byte GCM auth tag; versioned envelope `{ version: 1, iv, authTag, encrypted }` as JSON string (supports future key rotation). Tampered ciphertext throws "data may have been tampered with".
- Applied transparently via a TypeORM **ValueTransformer** on `DRADataSource.connection_details` (and `connection_string`); backward-compatible with legacy unencrypted rows.
- Also used for OAuth tokens at rest in Redis (encrypted strings) and SSO/misc secrets.

## Rate limiting (`middleware/rateLimit.ts` + `utils/RateLimiter.ts`)

**HTTP limiters** (express-rate-limit v8; all disable with `RATE_LIMIT_ENABLED=false`; default **in-memory store** — not Redis):

| Limiter | Window | Max | Keyed by |
|---|---|---|---|
| `generalApiLimiter` | 1 min | 100 | user_id or IP — **applied globally** |
| `authLimiter` | 15 min | 5 | IP — brute force |
| `expensiveOperationsLimiter` | 1 min | 10 | user/IP — uploads/sync/AI-heavy |
| `oauthCallbackLimiter` | 5 min | 10 | IP — skips successes (used on SSO routes only) |
| `aiOperationsLimiter` | 1 min | 30 | user/IP |
| `insightsLimiter` | 1 hour | 15 | user/IP |
| `mongoDBOperationsLimiter` | 15 min | 30 | user/IP |
| `invitationLimiter` | 15 min | 10 | user/IP |
| `tokenValidationLimiter` | 1 min | 500 | user/IP — multi-tab UX |

`getClientIp()` is proxy-aware: `X-Real-IP` → `CF-Connecting-IP` → `X-Forwarded-For` (first) → `Fastly-Client-IP` → `True-Client-IP` → `X-Client-IP` → `req.ip` (requires `app.set('trust proxy', true)`).

**Outbound limiter**: `utils/RateLimiter.ts` token-bucket + sliding-window with promise queue (`RateLimiterRegistry`, `createForGAM()` 10 req/min burst 20) for third-party API throttling (Google Ad Manager).

## Input validation

- **`middleware/validator.ts`** — express-validator wrapper (`validate(validations)`, 400 with `errors[]`) + `validatePasswordStrength` (≥8 chars, upper+lower+digit+special).
- **`middleware/validation.ts`** — legacy manual validators: `sanitizeInput` (XSS tag-strip), `isValidEmail`, `isStrongPassword`, `hasSQLInjection` regex, `validateDataSource/DataModel/Dashboard/UserInput`.
- **`middleware/validateFileUpload.ts`** — Excel size (Content-Length vs `MAX_EXCEL_FILE_SIZE_MB` default 50) + type allowlist (xlsx/xls/xlsm/csv); `validateQueueSize` is a placeholder no-op. Multer route limit for Excel is 500 MB; Express bodyParser 1000 mb; 10-min request/response timeouts.

## SQL injection protection

- **`SQLValidationService`** — cleaning SQL must use allowed ops (SELECT/UPDATE/DELETE/INSERT/WITH/BEGIN/COMMIT/ROLLBACK/SAVEPOINT); blocked ops (DROP, TRUNCATE, ALTER, CREATE/DROP DATABASE, GRANT, REVOKE, VACUUM, ANALYZE, CREATE USER…); `CREATE TABLE` only as TEMP; warns on DELETE/UPDATE without WHERE; multi-statement requires transaction; injection patterns (`; DROP`, `UNION SELECT`, `1=1`, trailing `--`); `validateTableReference`/`validateColumnReferences` use **parameterized queries** against `information_schema`.
- **`AISQLValidatorService`** — Gemini-generated widget SQL must start with SELECT and every `dra_*` schema.table reference must exist in `dra_table_metadata` for the project (parameterized whitelist).
- `QueryEngineProcessor` applies row limits and schema validation before executing user/derived SQL.

## XSS

- **Frontend**: `useMarkdown` → `marked` (GFM) → **`isomorphic-dompurify`** allow-list (`p br strong em u code pre h1–h6 ul ol li blockquote a`, attrs `href class` only); inline variant via `marked.parseInline`.
- **Backend**: `sanitizeInput` strips HTML tags as defense-in-depth; article content sanitized on the client when rendered.

## Authentication & sessions

- JWT (non-expiring payload `{user_id, user_type, email}`) bound by a 3-day `dra_auth_token` cookie (sameSite strict); no refresh-token flow. `changePasswordRequest` is anti-enumeration (always true, ≥2 s delay, 5-min cooldown, revokes prior tokens); `updatePassword` has a 1 s delay and rejects password reuse.
- SAML SSO hardened config + replay protection + one-time codes (see [04 — Authentication & RBAC](04-authentication-rbac.md)).
- OAuth: tokens never stored client-side (Google flow keeps only a UUID session id; encrypted Redis storage, 15-min TTL).

## reCAPTCHA v3

- Frontend `recaptcha.ts` plugin + `verifyRecaptchaToken` → `POST /verify-recaptcha` (non-auth JWT) → backend proxies to Google `siteverify` with `RECAPTCHA_SECRET`. Applied to enterprise-inquiry (score >0.8), all data-source connect forms, and unsubscribe.

## GDPR / privacy

- **Consent Mode v2** (GTM only when `NUXT_GTM_ID` set): defaults denied before GTM loads (`wait_for_update:3000`, `url_passthrough`, `ads_data_redaction`); `ga-consent.client.ts` restores saved consent within the window; regional model via `GeolocationService` (MaxMind GeoLite2 — EU/EEA/UK opt-in, California auto-accept + opt-out, rest-of-world implied); 180-day consent memory; monthly MaxMind DB update cron (`0 2 1 * *`).
- **Data retention**: platform setting `data_retention_days` (default 30) drives account cancellation; `ScheduledDeletionJob` warns at 7/1 days then `DataDeletionService.deleteUserData` (single transaction: revoke OAuth, delete files, cascade projects/notifications, purge Redis, **anonymize** user + owned-org billing IDs, confirmation email).
- **Webhook TTL**: 90-day hard-delete of processed Paddle payloads (emails/billing addresses) — GDPR storage limitation.
- **Product events PII stripping**: `ProductAnalyticsService.stripPII` (email redaction, sensitive keys dropped, depth ≤6).

## Access control summary

- `authorize`/`authorizeAll` (RBAC ANY/ALL), `rbacMiddleware` (project/data-source/model/dashboard permissions), `organizationContext`/`workspaceContext` (tenant membership + roles), `requiresProjectRole` (marketing personas), `tierEnforcement` (402 quota gates), `requiresProductionAccess` (admin-only integrations), `validateJWT` (auth vs non-auth tokens). Platform `user_type=admin` bypasses tier limits and tenant/project role checks, but **not** `authorize()`/`rbacMiddleware` (an admin who isn't a project member still fails).
- Tenancy isolation is application-level only (**no Postgres RLS**); some tables (`dra_reports`, `dra_report_items`, `dra_report_share_keys`) lack org/workspace columns — access relies on project + creator checks.

## Known security debt (documented, not fixed)

- CORS callback always returns `true` ("Allow for now, can restrict later") with credentials enabled.
- OAuth state is unsigned with no expiry/nonce; the Google OAuth callback routes are not rate-limited (the SAML SSO callback uses `oauthCallbackLimiter`); session GET/DELETE don't verify ownership.
- JWT has no `exp` claim (cookie-bound only); no refresh flow.
- Rate limits use in-memory stores (per-process), not Redis.
- `validateQueueSize` is a no-op placeholder.
- Several legacy admin CMS routes rely on processor-level auth checks rather than a common `requireAdmin`.
