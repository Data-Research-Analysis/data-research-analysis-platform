# UC-01 — Authentication & Identity Management

**Domain:** Authentication & Identity Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Guest** | Primary Human | Unauthenticated visitor with no session |
| **Registered User** | Primary Human | Authenticated account holder with a valid JWT |
| **Email Service** | Secondary System | Transactional email provider (SMTP/SendGrid) |
| **OAuth Provider** | Secondary System | Google Identity Platform |
| **JWT Middleware** | Secondary System | Internal `validateJWT` middleware; validates and decodes tokens on every protected request |
| **Rate Limiter** | Secondary System | `authLimiter` — 10 requests / 15 min on login and register routes |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|           <<system boundary>>                             |
|        Authentication & Identity Management               |
|                                                           |
|  UC-AUTH-01  Register Account                            |
|  UC-AUTH-02  Login with Email / Password                 |
|  UC-AUTH-03  Login via Google OAuth                      |
|  UC-AUTH-04  Verify Email Address                        |
|  UC-AUTH-05  Resend Verification Code                    |
|  UC-AUTH-06  Forgot / Reset Password                     |
|  UC-AUTH-07  Logout                                      |
|  UC-AUTH-08  Validate Token (session check)              |
|  UC-AUTH-09  Get Authenticated User Profile              |
|  UC-AUTH-10  Unsubscribe via Email Link                  |
+-----------------------------------------------------------+

Actors:
  Guest ---------> UC-AUTH-01, UC-AUTH-02, UC-AUTH-03,
                   UC-AUTH-04, UC-AUTH-05, UC-AUTH-06,
                   UC-AUTH-10
  Registered User -> UC-AUTH-07, UC-AUTH-08, UC-AUTH-09
  Email Service <-- UC-AUTH-01 (sends verification email)
                    UC-AUTH-06 (sends reset password email)
  OAuth Provider <- UC-AUTH-03

<<include>> relationships:
  UC-AUTH-02 <<include>> Validate Input Fields
  UC-AUTH-02 <<include>> Generate JWT Token
  UC-AUTH-03 <<include>> Generate JWT Token
  UC-AUTH-01 <<include>> Send Verification Email
  UC-AUTH-06 <<include>> Send Password Reset Email

<<extend>> relationships:
  UC-AUTH-02 <<extend>> Enforce Rate Limit
  UC-AUTH-01 <<extend>> Enforce Rate Limit
```

---

## UC-AUTH-01 — Register Account

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-01 |
| **Use Case Name** | Register Account |
| **Primary Actor** | Guest |
| **Secondary Actors** | Email Service |
| **Priority** | Critical |
| **Trigger** | Guest submits the registration form |
| **Preconditions** | 1. Guest is not authenticated. 2. Guest has navigated to `/register`. |
| **Postconditions (Success)** | 1. User record created in `dra_users` with `email_verified = false`. 2. Verification email dispatched. 3. 200 response returned. |
| **Postconditions (Failure)** | No user record created. Guest receives an error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Navigates to `/register` and fills in `first_name`, `last_name`, `email`, `password` (min 8 chars). |
| 2 | System | Applies `authLimiter` rate limit check (10 req / 15 min). |
| 3 | System | Validates all fields using express-validator; checks password strength via `validatePasswordStrength` middleware. |
| 4 | System | Checks for duplicate email in `dra_users`. |
| 5 | System | Hashes password with bcrypt and persists new user record. |
| 6 | System | Generates a unique verification token and stores it. |
| 7 | System | Dispatches a verification email containing a link with the token. |
| 8 | System | Returns HTTP 200 with message: *"User registered successfully. Please check your email…"* |
| 9 | Guest | Checks email inbox and clicks the verification link. |

### Alternative Flows

**ALT-01A — Email Already Registered**
- At step 4: duplicate found.
- System returns HTTP 400: *"User already exists for the given email, please provide a new email."*
- Use case ends.

**ALT-01B — Rate Limit Exceeded**
- At step 2: limit breached.
- System returns HTTP 429 with `Retry-After` header.
- Use case ends.

**ALT-01C — Weak Password**
- At step 3: `validatePasswordStrength` fails.
- System returns HTTP 422 with password policy violation message.
- Use case ends.

**ALT-01D — Missing / Invalid Fields**
- At step 3: validation errors.
- System returns HTTP 422 with field-level validation errors.
- Use case ends.

### Business Rules
- BR-AUTH-01: Password minimum length is 8 characters.
- BR-AUTH-02: Email must be a valid RFC 5321 address.
- BR-AUTH-03: Duplicate email addresses are rejected.
- BR-AUTH-04: Verification link must be sent before the user can log in.

---

## UC-AUTH-02 — Login with Email / Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-02 |
| **Use Case Name** | Login with Email / Password |
| **Primary Actor** | Guest |
| **Secondary Actors** | JWT Middleware, Rate Limiter |
| **Priority** | Critical |
| **Trigger** | Guest submits the login form |
| **Preconditions** | 1. Guest has a verified, active account. 2. Guest is on `/login`. |
| **Postconditions (Success)** | 1. JWT access token returned. 2. User session established on client. 3. Guest is redirected to the project list. |
| **Postconditions (Failure)** | No token issued. Guest receives error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Submits `email` and `password` to `POST /login`. |
| 2 | System | Applies `authLimiter`. |
| 3 | System | `validateJWT` checks for an existing valid token; if valid, redirects to dashboard (already logged in). |
| 4 | System | Validates `email` and `password` fields (non-empty). |
| 5 | System | Looks up user by email in `dra_users`; verifies bcrypt hash. |
| 6 | System | Checks `email_verified = true`. |
| 7 | System | Generates and returns signed JWT. |
| 8 | Client | Stores JWT; redirects to projects dashboard. |

### Alternative Flows

**ALT-02A — Invalid Credentials**
- At step 5: email not found or password mismatch.
- HTTP 400: *"User not found for the provided email and password."*
- Use case ends.

**ALT-02B — Email Not Verified**
- At step 6: `email_verified = false`.
- HTTP 403 with prompt to verify email.
- Use case ends.

**ALT-02C — Already Authenticated**
- At step 3: valid JWT detected.
- System skips login flow; redirects to dashboard.

**ALT-02D — Rate Limit Exceeded**
- At step 2: HTTP 429 returned.

### Business Rules
- BR-AUTH-05: Only verified accounts may receive a JWT.
- BR-AUTH-06: Failed authentication must not reveal whether the email exists (generic error message).

---

## UC-AUTH-03 — Login via Google OAuth

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-03 |
| **Use Case Name** | Login via Google OAuth |
| **Primary Actor** | Guest |
| **Secondary Actors** | OAuth Provider (Google), JWT Middleware |
| **Priority** | High |
| **Trigger** | Guest clicks "Sign in with Google" |
| **Preconditions** | Google OAuth credentials configured on backend. |
| **Postconditions (Success)** | JWT issued; user record created or updated. |
| **Postconditions (Failure)** | Guest returned to login page with error. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Clicks "Sign in with Google". |
| 2 | System | Redirects to Google OAuth consent screen. |
| 3 | Google | Authenticates user and returns authorisation code to `/oauth/callback`. |
| 4 | System | Exchanges code for Google access token and ID token. |
| 5 | System | Extracts `email`, `given_name`, `family_name` from ID token. |
| 6 | System | Upserts user in `dra_users` (creates if new, updates if existing). |
| 7 | System | Issues platform JWT. |
| 8 | Client | Stores JWT; redirects to projects dashboard. |

### Alternative Flows

**ALT-03A — OAuth Callback Failure (state mismatch / denied)**
- At step 3: Google returns error.
- System logs and redirects to `/login?error=oauth_failed`.

**ALT-03B — Email Associated with Password Account**
- At step 6: email exists with `auth_method = password`.
- System merges OAuth identity or prompts user to login with password.

---

## UC-AUTH-04 — Verify Email Address

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-04 |
| **Use Case Name** | Verify Email Address |
| **Primary Actor** | Guest |
| **Trigger** | Guest clicks verification link from email |
| **Preconditions** | Verification token exists and is unexpired. |
| **Postconditions (Success)** | `email_verified = true` on user record. Guest prompted to log in. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Clicks verification link: `GET /verify-email/:code`. |
| 2 | System | Validates `:code` (non-empty, param check). |
| 3 | System | Looks up token; checks expiry. |
| 4 | System | Sets `email_verified = true`, invalidates token. |
| 5 | System | Returns HTTP 200: *"Email verified successfully. Please login to continue."* |
| 6 | Guest | Navigated to login page. |

### Alternative Flows

**ALT-04A — Token Expired or Invalid**
- At step 3: token not found or expired.
- HTTP 400: *"Email verification failed. The code has expired. Please try again."*

---

## UC-AUTH-05 — Resend Verification Code

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-05 |
| **Use Case Name** | Resend Verification Code |
| **Primary Actor** | Guest |
| **Trigger** | Guest requests a new verification code via `GET /resend-code/:code` |
| **Preconditions** | Original code exists in system (even if expired). |
| **Postconditions (Success)** | New verification code generated and emailed. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Requests resend with current/original code. |
| 2 | System | Validates original code exists. |
| 3 | System | Generates new token; sends new verification email. |
| 4 | System | HTTP 200: *"New code sent."* |

### Alternative Flows

**ALT-05A — Original Code Not Found**
- At step 2: HTTP 400: *"New code generation has failed. It is most likely that the provided code is incorrect…"*

---

## UC-AUTH-06 — Forgot / Reset Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-06 |
| **Use Case Name** | Forgot / Reset Password |
| **Primary Actor** | Guest |
| **Secondary Actors** | Email Service |
| **Trigger** | Guest navigates to `/forgot-password` and submits their email |
| **Postconditions (Success)** | Password reset email sent; user can set new password via link. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Submits email address on forgot-password form. |
| 2 | System | Looks up account; generates password reset token with expiry. |
| 3 | System | Sends password reset email with tokenised link. |
| 4 | Guest | Clicks link; lands on reset form; submits new password. |
| 5 | System | Validates new password strength; hashes and updates record. |
| 6 | System | Invalidates reset token. |
| 7 | System | Redirects to login page. |

### Alternative Flows

**ALT-06A — Email Not Found**
- At step 2: system responds identically (HTTP 200) to prevent email enumeration.

**ALT-06B — Reset Token Expired**
- At step 4: token invalid → HTTP 400; Guest prompted to request a new link.

---

## UC-AUTH-07 — Logout

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-07 |
| **Use Case Name** | Logout |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks "Logout" |
| **Postconditions (Success)** | JWT cleared from client; user redirected to `/login`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks Logout. |
| 2 | Client | Removes JWT from storage; clears Pinia store state and localStorage. |
| 3 | Client | Redirects to `/login`. |

*Note: Backend is stateless (JWT); no server-side session invalidation is required.*

---

## UC-AUTH-08 — Validate Token (Session Check)

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-08 |
| **Use Case Name** | Validate Token |
| **Primary Actor** | Registered User (client-initiated on page load) |
| **Trigger** | Client calls `GET /validate-token` to check session validity |
| **Postconditions (Success)** | HTTP 200 — session still valid. |
| **Postconditions (Failure)** | HTTP 401 — client clears token and redirects to login. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Sends `GET /validate-token` with `Authorization: Bearer <token>`. |
| 2 | System | `validateJWT` verifies signature and expiry. |
| 3 | System | HTTP 200: *"validated token"* |

### Alternative Flows

**ALT-08A — Token Expired or Tampered**
- HTTP 401 returned; client clears auth state.

---

## UC-AUTH-09 — Get Authenticated User Profile

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-09 |
| **Use Case Name** | Get Authenticated User Profile |
| **Primary Actor** | Registered User |
| **Trigger** | Client calls `GET /me` |
| **Postconditions (Success)** | User profile object returned (name, email, role, subscription tier). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /me` with JWT. |
| 2 | System | `validateJWT` extracts `user_id` from token. |
| 3 | System | Fetches user by `user_id` from `dra_users`. |
| 4 | System | Returns user object. |

### Alternative Flows

**ALT-09A — User Not Found (deleted)**
- HTTP 404 returned.

**ALT-09B — No Token**
- HTTP 401 returned.

---

## UC-AUTH-10 — Unsubscribe via Email Link

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-10 |
| **Use Case Name** | Unsubscribe via Email Link |
| **Primary Actor** | Guest / Registered User |
| **Trigger** | User clicks unsubscribe link in an email; browser calls `GET /unsubscribe/:code` |
| **Postconditions (Success)** | User's `email_subscribed` flag set to `false`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks unsubscribe link from email. |
| 2 | System | Validates `:code`. |
| 3 | System | Sets `email_subscribed = false` for corresponding user. |
| 4 | System | HTTP 200: *"Unsubscribed successfully."* |

### Alternative Flows

**ALT-10A — Invalid Code**
- HTTP 400: *"Unsubscription failed. Please try again."*
