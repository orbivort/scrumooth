# Security Policy

## Security Policy Overview

The Scrumooth team takes security seriously. We are committed to ensuring the security and privacy of our users' data and maintaining the integrity of Scrumooth, the self-hosted Scrum Guide enforcement layer. Because the rules of the 2020 Scrum Guide are enforced server-side, the security of the backend _is_ the integrity of the process. This document outlines our security policy, supported versions, and the process for reporting security vulnerabilities.

### Our Security Commitment

- **Data Protection**: We implement industry-standard security measures to protect user data
- **Secure Development**: We follow secure coding practices and conduct regular security reviews
- **Transparency**: We maintain open communication about security issues and their resolutions
- **Continuous Improvement**: We continuously enhance our security posture based on best practices and community feedback

## Supported Versions

We provide security updates for the following versions of Scrumooth:

| Version | Supported | End of Life | Notes                  |
| ------- | --------- | ----------- | ---------------------- |
| 2.x     | ✅ Yes    | <br />      | Current stable release |

### Version Support Policy

- **Current Stable Release**: Receives all security updates and patches
- **End of Life (EOL)**: Versions past their EOL date no longer receive security updates

### Upgrade Recommendations

We strongly recommend all users to:

1. Always use the latest stable version
2. Review changelog for security-related changes

## Reporting a Vulnerability

We appreciate and welcome security research and responsible disclosure. If you discover a security vulnerability in Scrumooth, please report it to us immediately.

### How to Report

**Preferred Method: GitHub Security Advisory**

1. Navigate to our [Security Advisories page](https://github.com/orbivort/scrumooth/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the form with detailed information
4. Submit the report

### What to Include in Your Report

Please provide as much information as possible:

1. **Vulnerability Description**
   - Clear and concise description of the vulnerability
   - Type of vulnerability (e.g., XSS, SQL injection, CSRF, authentication bypass)
   - Affected components or endpoints
2. **Steps to Reproduce**
   - Detailed step-by-step instructions
   - Proof of concept (PoC) code if available
   - Screenshots or videos if applicable
3. **Impact Assessment**
   - Potential impact on users and systems
   - Attack vector (network, local, physical)
   - Required privileges or authentication
4. **Environment Details**
   - Scrumooth version number
   - Node.js version
   - PostgreSQL version
   - Operating system
   - Browser (if frontend-related)
5. **Suggested Fix** (Optional)
   - Proposed solution or mitigation
   - Relevant code references

### Example Report Template

```
**Vulnerability Title**: [Brief descriptive title]

**Severity**: [Critical/High/Medium/Low]

**Affected Versions**: [List affected versions]

**Description**:
[Detailed description of the vulnerability]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Proof of Concept**:
[Code or commands to demonstrate the vulnerability]

**Impact**:
[Description of potential impact]

**Environment**:
- Scrumooth Version: [version]
- Node.js Version: [version]
- PostgreSQL Version: [version]
- OS: [operating system]
- Browser: [browser and version]

**Suggested Fix**:
[Optional: proposed solution]
```

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**
2. **Initial Assessment**: We will provide an initial assessment within **5 business days**
3. **Regular Updates**: We will keep you informed of our progress throughout the process
4. **Resolution Timeline**: We aim to resolve critical vulnerabilities within **7 days**, high severity within **14 days**, and medium/low severity within **30 days**

### Safe Harbor

We support responsible security research. We will not pursue legal action against security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts they own or with explicit permission from the account holder
- Do not access, modify, or delete data that does not belong to them
- Report vulnerabilities promptly
- Do not disclose vulnerabilities publicly before we have had a reasonable time to address them
- Follow this security policy and applicable laws

## Security Best Practices for Users

### Authentication and Access Control

1. **Strong Passwords**: Use strong, unique passwords (minimum 12 characters)
2. **Role-Based Access**: Assign minimum required roles to team members
3. **Regular Audits**: Review team member access regularly
4. **Session Management**: Log out from unused sessions; use session timeout features

### Deployment Security

1. **Environment Variables**: Never commit `.env` files; use secure secret management
2. **HTTPS**: Always use HTTPS in production
3. **Database Security**: Use strong database passwords; restrict network access
4. **Updates**: Keep Scrumooth and dependencies up to date
5. **Backups**: Regular database backups with encryption

### Infrastructure Security

1. **Network Security**: Use firewalls to restrict access
2. **Monitoring**: Implement logging and monitoring for security events
3. **Rate Limiting**: Configure appropriate rate limits
4. **CORS**: Configure CORS to allow only trusted origins
5. **Content Security Policy**: Enable CSP headers

### Data Protection

1. **Encryption**: Ensure database encryption at rest
2. **GDPR Compliance**: Follow data protection regulations
3. **Data Minimization**: Collect only necessary data
4. **Retention Policies**: Implement appropriate data retention
5. **Backup Security**: Encrypt and secure backup files

## Security Features

Scrumooth implements comprehensive security measures:

### Authentication & Authorization

- **JWT-Based Authentication**: Secure token-based authentication with refresh tokens
- **Password Hashing**: bcrypt with configurable work factors (minimum 12 rounds)
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (Administrator, Product Owner, Scrum Master, Developer)
- **Session Management**: Idle timeout (30 min) and absolute timeout (24 hours)
- **Concurrent Session Limits**: Maximum 5 concurrent sessions per user
- **Secure Cookie Storage**: HttpOnly, Secure, and SameSite flags
- **Password Reset**: Secure token-based password reset with 1-hour expiration and email notification

### Input Validation & Sanitization

- **Request Validation**: All inputs validated using Zod schemas
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Prevention**: React's built-in escaping and markdown sanitization
- **CSRF Protection**: Token-based CSRF protection using double-submit cookie pattern with HMAC-signed tokens
- **Input Sanitization**: sanitize-html for rich text inputs

### Network Security

- **Rate Limiting**: Configurable rate limits on all endpoints
  - Authentication endpoints: 5 attempts per 15 minutes
  - Login endpoints: 10 attempts per 15 minutes
  - API endpoints: 100 requests per 15 minutes (configurable)
  - Password reset endpoints: 3 requests per 15 minutes
  - Forgot password endpoints: 3 requests per 15 minutes
- **CORS Configuration**: Explicit origin whitelisting
- **HTTP Security Headers**: Helmet middleware with:
  - Content Security Policy (CSP)
  - HTTP Strict Transport Security (HSTS)
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - X-XSS-Protection

### Audit & Monitoring

- **Comprehensive Audit Logging**: All sensitive operations logged
- **Request ID Tracking**: Unique IDs for request tracing
- **Security Event Logging**: Authentication events, authorization failures
- **Structured Logging**: JSON-formatted logs with rotation
- **Log Retention**: 14-day retention for combined logs, 30-day retention for audit logs (configurable policies)

### Data Protection

- **Encryption at Rest**: Database encryption support
- **Encryption in Transit**: TLS/HTTPS required
- **Token Hashing**: SHA-256 hashing for refresh tokens and password reset tokens
- **Secure Data Export**: GDPR-compliant data export with consent tracking
- **Account Deletion**: Secure deletion with 14-day grace period
- **Privacy Controls**: Marketing opt-in, terms acceptance tracking

## Security Architecture

### Backend Security

- **Service Layer Pattern**: Business logic isolated from HTTP layer
- **Transaction Support**: ACID transactions for data integrity
- **Connection Pooling**: Prisma connection pooling for performance and security
- **Error Handling**: Custom error classes without sensitive information leakage
- **Dependency Management**: Regular dependency audits and updates

### Frontend Security

- **Secure Token Storage**: HTTP-only cookies (not localStorage or sessionStorage)
- **Content Security Policy**: Strict CSP to prevent XSS
- **XSS Prevention**: React's automatic escaping
- **CSRF Token Handling**: Automatic CSRF token management in API requests
- **Error Boundaries**: Graceful error handling without exposing details
- **No Token Logging**: Tokens are never logged to console or exposed in error messages

### Database Security

- **Prisma ORM**: Type-safe database access
- **Parameterized Queries**: SQL injection prevention
- **Connection Encryption**: SSL/TLS database connections
- **Access Control**: Database user with minimal required privileges
- **Regular Backups**: Automated backup with encryption

## Security Testing

We maintain security through comprehensive testing:

### Automated Security Testing

- **Static Application Security Testing (SAST)**: ESLint security plugins
- **Dependency Scanning**: Automated vulnerability scanning of dependencies
- **Code Analysis**: TypeScript strict mode for type safety
- **Unit Tests**: Security-focused unit tests
- **Integration Tests**: Security scenario testing

### Manual Security Testing

- **Code Reviews**: Security-focused code reviews
- **Penetration Testing**: Periodic third-party security assessments
- **Security Audits**: Regular security architecture reviews
- **Threat Modeling**: Ongoing threat assessment

### User Notification

We will notify users of security incidents via:

- GitHub Security Advisories
- Release notes

## Image Vulnerability Monitoring

Container images are scanned as part of the release pipeline. The production
base images are pinned for reproducibility:

- **Backend (Node.js)**: `node:24.19.0-trixie-slim` — Node.js 24.x LTS on Debian 13
  (trixie). The Debian variant is pinned via the `DEBIAN_VARIANT` build arg in
  `packages/backend/Dockerfile` and `packages/backend/Dockerfile.dev` rather than
  using the floating `-slim` tag, which resolves to the aging bookworm (Debian 12)
  package set and accumulates CVEs.
- **Frontend builder (Node.js)**: `node:24.19.0-trixie-slim` (same policy).
- **Frontend runtime (nginx)**: `nginx:${NGINX_VERSION}-alpine` — pinned to the
  latest stable nginx series via the `NGINX_VERSION` build arg.

### Known Upstream Findings (tracked, not actionable in-repo)

After moving to the trixie base, scanners still report a small set of CVEs that
**cannot** be fixed in this repository because they originate upstream:

1. **npm CLI bundled inside the Node image** (`tar`, `undici`, `brace-expansion`,
   `ip-address`). These are internal dependencies of the `npm`/`npx` CLI shipped
   with Node and are **not** part of Scrumooth's own dependency tree (`pnpm audit`
   is clean). They are fixed by a future Node.js 24.x LTS patch release, not by
   this project. Do not add pnpm/npm overrides for them.
2. **`deb/perl`** in trixie — recent CVEs with no patched perl package released in
   any Debian distribution yet. They clear automatically once Debian publishes
   updates.

### Monitoring Cadence

Re-run the image scanner (`docker scan`, Trivy, Grype, or the CI-integrated
scanner) and verify these findings are cleared after each of:

- A **Node.js 24.x LTS patch release** (bumps bundled npm → clears npm CLI CVEs)
- A **Debian trixie point release** (clears `deb/perl` CVEs)

Refer to the inline comment block "KNOWN UPSTREAM CVEs" in
`packages/backend/Dockerfile` for the authoritative current list.

## Policy Updates

This security policy is reviewed and updated regularly

### Version History

| Version | Date       | Changes                                                                               |
| ------- | ---------- | ------------------------------------------------------------------------------------- |
| 1.0     | 2026-05-04 | Initial security policy                                                               |
| 2.0     | 2026-06-07 | Updated version                                                                       |
| 2.1     | 2026-08-16 | Added Image Vulnerability Monitoring section (Debian 13 base + upstream CVE tracking) |

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://react.dev/learn/keeping-components-pure)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/security)
- [GitHub Security Lab](https://securitylab.github.com/)

---

**Thank you for helping keep Scrumooth and our users safe!**
