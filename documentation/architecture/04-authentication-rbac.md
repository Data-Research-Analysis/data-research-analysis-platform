# 04 — Authentication & RBAC

## Identity layers

| Layer | Roles | Storage | Enforced by |
|---|---|---|---|
| Platform | `admin` / `normal` | `dra_users_platform.user_type` | `TierEnforcementService.isAdmin`, `organizationContext`, `requiresProjectRole`, admin routes |
| Organization | `owner` / `admin` / `member` | `dra_organization_members.role` | `organizationContext` + `requireOrganizationRole` |
| Workspace | `admin` / `editor` / `viewer` | `dra_workspace_members.role` | `workspaceContext` + `requireWorkspaceRole` (and service-level checks) |
| Project (marketing) | `analyst` / `manager` / `cmo` | `dra_project_members.marketing_role` (default `cmo`) | `RBACService`, `authorize`, `rbacMiddleware`, `requiresProjectRole`, `InvitationService` |

Project ownership is implicit: `dra_projects.users_platform_id` is treated as `analyst` (full access). The legacy `EProjectRole` (`owner/admin/editor/viewer`) is mapped from marketing roles by `PermissionService` (analyst→OWNER, manager→ADMIN, cmo→VIEWER).

## Permission model

`backend/src/constants/permissions.ts` defines **18 permissions** in `resource:action` form (PROJECT_*, DATA_SOURCE_*, DATA_MODEL_*, DASHBOARD_*). `MARKETING_ROLE_PERMISSIONS` is authoritative:

- **analyst**: all 18 (create/edit/delete/manage members)
- **manager**: 14 — no DELETE on any resource; project edit/manage-members; data source view/create/edit; data model view/create/edit/execute; dashboard view/create/edit/share
- **cmo**: 5 — read-only (project view, data source view, data model view/execute, dashboard view)

`PermissionService` provides the final enforcement matrix (CREATE/READ/UPDATE/DELETE per mapped role) with helpers `hasProjectAccess`, `canPerformActionOn{Project,DataSource,DataModel,Dashboard}`, resolving project ids from resources (including cross-source models via `dra_data_model_sources`).

## JWT authentication

- `TokenProcessor` — `generateToken` (empty-payload token for non-auth routes), `validateToken` (`jwt.verify`), `getTokenDetails`.
- **JWT payload is `{user_id, user_type, email}` with no `exp` claim** (non-expiring tokens). The effective 3-day bound comes from the cookie.
- `middleware/authenticate.ts` (`validateJWT`): strips `Bearer `, validates, branches on `authorization-type` header (`auth` populates `req.tokenDetails`/`req.user_id`; `non-auth` accepts any valid token). **Missing Authorization header passes through** — routes opt into protection downstream.
- Frontend: `dra_auth_token` cookie via `useCookie` (3-day, `sameSite: 'strict'`); no refresh-token flow exists.

## Password & anti-abuse (AuthProcessor)

- Registration: bcrypt hash with `PASSWORD_SALT` (default 10 rounds); email verification + unsubscribe codes are bcrypt hashes of `${email}${password}`, 3-day expiry; auto-creates personal Free org (unless pending org invitations); enrolls in `free-user-onboarding` email funnel.
- `changePasswordRequest`: anti-enumeration (always returns true), ≥2 s delay, 5-min cooldown, revokes all prior tokens.
- `updatePassword`: 1 s delay, rejects same-password reuse, clears all verification codes.
- Password strength: `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*-]).{8,}$`.
- SSO enforcement on login: if the email domain matches an org with active `enforce_sso`, password login is blocked.

## SAML SSO (`SSOService` / `SSOProcessor`)

- `@node-saml/passport-saml`, HTTP-Redirect binding. Hardened: `wantAssertionsSigned`, `wantAuthnResponseSigned`, `ValidateInResponseTo: ifPresent`, 5 s clock skew, 5 min max assertion age, 300 s requestId expiry.
- **Replay protection**: SHA-256 digest of the raw SAML response stored in Redis `sso:assertion:replay:*` (`SET ... EX 300 NX`).
- **One-time codes**: `createOneTimeCode` — 32 random bytes, Redis `sso:otc:*` with 60 s TTL, single-use — the JWT never appears in the callback URL. RelayState is a JWT signed with `JWT_SECRET` (`10m`).
- Admin-gated config (owner/admin); **Enterprise-tier requirement** (tier_rank ≥ 40) via `ensureEnterpriseTier` (admins bypass); **domain verification via DNS TXT `dra-verify=<token>`**; JIT provisioning; `DRASSOUserMapping`; audit logging to `WinstonLoggerService` (`sso_audit`).

## OAuth (Google + Meta + LinkedIn + HubSpot)

- Google OAuth (`GoogleOAuthService` + `OAuthSessionService`): `access_type=offline`, `prompt=consent`; tokens **encrypted at rest** in Redis (`oauth:session:*`, AES-256-GCM), 15-min TTL, 30-min cleanup; frontend keeps only a UUID `session_id` in `sessionStorage`; per-service scopes (analytics: `analytics`+`analytics.readonly`; ad_manager: `dfp`; google_ads: `adwords`). **No PKCE; state is an unsigned base64 blob (user_id checked on POST callback); OAuth callback routes carry no rate limiter; session GET/DELETE don't verify ownership** — documented gaps.
- Meta OAuth (`MetaOAuthService`): scopes exactly `ads_read` + `business_management`; long-lived tokens (~60 days) via `fb_exchange_token`, validated with `/debug_token`; tokens returned in JSON (not sessionized); expired token requires re-auth.
- LinkedIn OAuth: scopes `r_ads` + `r_ads_reporting`; tokens base64url'd into the frontend redirect.
- HubSpot OAuth v3: 5 `crm.objects.*` read scopes; 30-min access tokens, refresh when <5 min remain.

## Tenancy context middleware

- `organizationContext.ts`: org from `X-Organization-Id` → query → body; JWT required; admins bypass as OWNER; sets `req.organizationId`/`req.organizationRole`.
- `workspaceContext.ts`: must run after org context; workspace from `X-Workspace-Id` → query → body; validates workspace belongs to org + membership; sets `req.workspaceId`/`req.workspaceRole`. Org owners are implicitly workspace ADMIN.
- Frontend `useOrganizationContext` emits the headers on every request; org switching resets cached tier/usage via `subscription.resetForOrganizationChange()`.

## Tier enforcement

- `TierEnforcementService` (849 lines, singleton, Redis-backed): admin bypass; count caching (30 s Redis TTL); `canCreateProject/DataSource/DataModel/Dashboard`, `canUseAIGeneration` (increments Redis counter, TTL 31 days), `canCreatePlanBuild` (never refunded), `enforceAICostCeiling` (monthly USD from `AICallTrackerService.getMonthlyOrgCost`), entitlements (`canUsePlanAdvancedMode`, `canExportPlanDeck`, `canUseAdvancedTools`).
- `upgradeTiers` computed from **price** (strictly higher `price_per_month_usd`), mapping resource → tier column; returned in 402 `TierLimitError` payloads so the frontend `TierLimitModal` can render the ladder.
- 9 middlewares in `middleware/tierEnforcement.ts` returning HTTP 402; applied on project/data-source/data-model/dashboard create, AI generation, AI cost ceiling (intelligence), plan builds, sub-user adds, and advanced-tools gates.
- **Known inconsistencies**: counts are enforced per `users_platform_id` but tiers resolve per owned org; `canAddMember` queries the wrong resource key (`ai_generation`); `getUpgradeTiers` uses price not rank; several code paths compare `tier_name === 'Free'` (brittle vs `tier_rank`); count cache is never invalidated (30 s staleness); `SubscriptionLimitService` is dead code (superseded by `TierEnforcementService`).

## Invitations

- **Org invitations** (`OrganizationInvitationService`): existing users added directly; unknown emails get a 64-byte hex token, 7-day expiry; `invitationLimiter` 10/15 min.
- **Project invitations** (`InvitationService`): require analyst/manager, enforce `max_members_per_project` from owner's tier; **Free/Starter can only assign `cmo`**; invitee must already be an org member; token is a `DRAVerificationCode` (7-day expiry).

## Admin surface

27 files under `backend/src/routes/admin/` (see [05 — Billing](05-billing-subscription.md) for billing-adjacent ones): users, organizations, projects/members, stats, data-model-health, medallion-migration, platform-settings, ai-usage, jobs, paddle-sync, subscription-tiers, subscription-analytics, account-cancellations, downgrade-requests, promo-codes, paid-plans, articles (+digest), categories, images, sitemap, email-funnels, lead-generators, enterprise-queries, enterprise-contact-requests, scheduled-backups, database (backup/restore). Most use a local `requireAdmin` (403 for non-admins); some legacy CMS routes rely on processor-level checks — worth auditing.
