# Security Policy

## Our Commitment to Security

We take the security of this project seriously. We appreciate the efforts of security researchers and users who report vulnerabilities responsibly, and we are committed to working with the community to verify, reproduce, and respond to legitimate reported vulnerabilities.

## Supported Versions

The following versions of the project are currently receiving security updates:

| Version | Supported          | Notes                           |
| ------- | ------------------ | ------------------------------- |
| main    | :white_check_mark: | Current production branch       |

## Reporting a Vulnerability

**We strongly encourage responsible disclosure of security vulnerabilities.** Please do not publicly disclose security issues before giving us a reasonable time to address them.

### Where to Report

To report a security vulnerability, please use one of the following methods:

- **Email:** Send a detailed report to the project maintainers (hello@dataresearchanalysis.com)
- **GitHub Security Advisories:** Use GitHub's private vulnerability reporting feature (if enabled)
- **Subject Line:** Include `[SECURITY]` in the email subject line for priority handling

### What to Include in Your Report

To help us understand and address the issue quickly, please include:

1. **Description:** A clear description of the vulnerability
2. **Impact:** Potential impact and severity of the issue
3. **Affected Components:** Specify whether it affects:
   - Backend API (`/backend`)
   - Frontend application (`/frontend`)
   - Database layer
   - Authentication/OAuth flow
   - File processing features
   - Dependencies
4. **Steps to Reproduce:** Detailed steps to reproduce the vulnerability
5. **Proof of Concept:** Code, screenshots, or logs demonstrating the issue (if available)
6. **Environment:** Version, OS, browser, or other relevant environment details
7. **Suggested Fix:** Your recommendation for addressing the issue (optional but appreciated)
8. **CVE/CWE References:** If applicable (e.g., CWE-312, CWE-315, etc.)

### Response Timeline

We are committed to responding promptly to security reports:

| Timeline | Action |
| -------- | ------ |
| **48-72 hours** | Initial acknowledgment of your report |
| **Weekly** | Status updates on investigation and remediation |
| **Varies by severity** | Fix deployment timeline (see below) |

#### Fix Timeline by Severity

| Severity | Description | Target Fix Time |
| -------- | ----------- | --------------- |
| **Critical** | Actively exploited, direct data exposure, authentication bypass | 1-7 days |
| **High** | Potential for significant impact, privilege escalation, data leak | 7-14 days |
| **Medium** | Limited impact, requires specific conditions, information disclosure | 14-30 days |
| **Low** | Minimal impact, requires unlikely conditions, minor information leak | 30-90 days |

### What to Expect

**If the vulnerability is accepted:**
- We will confirm the issue and work on a fix
- We will keep you updated on our progress
- You will be credited in the release notes and security advisory (unless you prefer to remain anonymous)
- We will coordinate the disclosure timeline with you
- We will notify you when the fix is deployed

**If the vulnerability is declined:**
- We will provide a clear explanation of why we believe it is not a security issue
- We may suggest alternative ways to address your concern
- We remain open to further discussion if you have additional information

## Security Scope

### In Scope

The following components and security concerns are within scope for vulnerability reports:

#### Application Components
- Backend REST API (`/backend/src/`)
- Frontend Nuxt.js application (`/frontend/`)
- Database queries and data access patterns
- Authentication and authorization mechanisms
- OAuth 2.0 implementation (Google OAuth)
- Session management and token handling
- API endpoints and middleware
- File upload and processing (PDF, Excel)
- Data encryption and storage

#### Security Concerns
- SQL Injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Authentication and authorization bypass
- Sensitive data exposure
- Insecure cryptographic storage
- Security misconfiguration
- Broken access control
- Server-Side Request Forgery (SSRF)
- Injection flaws
- Insecure deserialization
- Dependency vulnerabilities (npm packages)
- API security issues
- Session management vulnerabilities

### Out of Scope

The following are generally considered out of scope:

- Social engineering attacks against users or maintainers
- Physical security issues
- Denial of Service (DoS/DDoS) attacks
- Brute force attacks without demonstrating a vulnerability
- Issues in unsupported versions or branches
- Issues requiring physical access to servers
- Vulnerabilities in third-party services (report to those vendors)
- Issues that require highly unlikely user interaction
- Clickjacking on pages with no sensitive actions
- Missing security headers without demonstrable impact
- Reports from automated tools without manual verification

**Note:** If you're unsure whether something is in scope, please report it anyway and we'll make the determination.

## Security Best Practices for Users

To help maintain the security of your deployment:

### For Administrators

- **Keep Dependencies Updated:** Regularly run `npm audit` and update packages
- **Environment Variables:** Store sensitive credentials in environment variables, never in code
- **Database Security:** Use strong passwords, limit database user permissions
- **OAuth Configuration:** Protect OAuth client secrets, use HTTPS for redirect URIs
- **Session Management:** Ensure Redis is properly secured with authentication
- **Encryption Keys:** Generate strong encryption keys using cryptographically secure methods
- **Rate Limiting:** Enable and configure rate limiting for API endpoints
- **HTTPS:** Always use HTTPS in production environments
- **Access Control:** Implement principle of least privilege for all accounts
- **Monitoring:** Enable logging and monitor for suspicious activities

### For Developers

- **Code Reviews:** Require security-focused code reviews for all changes
- **Input Validation:** Validate and sanitize all user inputs
- **Parameterized Queries:** Use parameterized queries to prevent SQL injection
- **Output Encoding:** Properly encode output to prevent XSS
- **Authentication:** Always verify user authentication and authorization
- **Secrets Management:** Never commit secrets, keys, or tokens to version control
- **Error Handling:** Avoid exposing sensitive information in error messages
- **Security Testing:** Write security-focused unit and integration tests

## Disclosure Policy

We follow a **coordinated disclosure** policy:

1. **Private Disclosure:** Please report vulnerabilities privately, not through public channels (issues, forums, social media)
2. **Collaboration:** Work with us to verify and reproduce the issue
3. **Coordinated Timeline:** We will work with you to agree on a disclosure timeline
4. **Public Disclosure:** Typically 90 days after a fix is released, or by mutual agreement
5. **Credit:** Security researchers will be publicly credited (if desired) in:
   - Release notes
   - Security advisories
   - CHANGELOG.md
   - This SECURITY.md file (Hall of Fame)

### Early Public Disclosure

If you plan to publicly disclose a vulnerability before we have released a fix:
- Please give us at least 90 days to develop and deploy a patch
- If actively exploited in the wild, we may need to accelerate the disclosure timeline
- We will work with you to coordinate disclosure timing

## Security Updates and Advisories

### Where Updates Are Published

Security patches and advisories are announced through:

- **CHANGELOG.md:** All security fixes are documented with `[SECURITY]` tag
- **GitHub Releases:** Security releases are marked as such
- **GitHub Security Advisories:** Critical vulnerabilities (when applicable)
- **Repository Notifications:** Watch the repository for security announcements

### Subscribing to Security Notifications

To stay informed about security updates:

1. **Watch this repository** on GitHub and enable notifications for releases
2. **Check CHANGELOG.md** regularly for `[SECURITY]` entries
3. **Monitor GitHub Security Advisories** for this repository

## Security Vulnerability Examples

We have recently addressed several security vulnerabilities, demonstrating our commitment to security:

### Recent Security Fixes

- **OAuth Token Storage (2024):** Fixed CWE-312, CWE-315, CWE-359 by implementing server-side session storage with AES-256-GCM encryption
  - Issue: OAuth tokens stored in plain text in browser sessionStorage
  - Fix: Moved token storage to Redis with encryption, client stores only session IDs
  - Severity: High
  - Documentation: [OAUTH_SECURITY_FIX.md](OAUTH_SECURITY_FIX.md)

## Contact Information

### Security Team

- **Email:** [Add your security contact email here]
- **Response Time:** We aim to respond within 72 hours
- **Preferred Language:** English
- **PGP Key:** [Optional - Add link to your public PGP key for encrypted communications]

### General Questions

For general security questions (not vulnerability reports), you can:
- Open a GitHub discussion (for non-sensitive topics)
- Contact the maintainers via the email provided in package.json
- Review our security documentation in this repository

## Hall of Fame

We would like to thank the following security researchers and contributors for responsibly disclosing vulnerabilities:

- *Your name could be here!*

## Related Documentation

For more information about contributing to this project:

- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards
- [OAUTH_SECURITY_FIX.md](OAUTH_SECURITY_FIX.md) - OAuth security implementation details
- [OAUTH_SECURITY_IMPLEMENTATION_SUMMARY.md](OAUTH_SECURITY_IMPLEMENTATION_SUMMARY.md) - Technical security documentation

## Acknowledgments

We appreciate the security research community's efforts in keeping open-source software secure. Your responsible disclosure helps protect all users of this project.

Thank you for helping us maintain a secure application!

---

**Last Updated:** December 2025  
**Version:** 1.0
