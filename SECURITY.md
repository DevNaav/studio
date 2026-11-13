# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.
Report them privately through GitHub: **Security → Report a vulnerability** on this repository.
You'll get a reply within a few days.

## How this project is protected

- **CI** (`.github/workflows/ci.yml`): every push and pull request is type-checked, built,
  audited for vulnerable production dependencies, and scanned for leaked secrets.
- **CodeQL** (`.github/workflows/codeql.yml`): static analysis for security bugs, weekly and on every change.
- **Dependabot**: weekly dependency updates and security alerts.
- **Secrets** live only in Vercel environment variables (and a local, git-ignored `.env.local`), never in the repository.
- **Firestore rules** (`firestore.rules`) restrict every read and write to the signed-in user's own company.
- **Uploaded files** are private (Vercel Blob) and only reachable through short-lived signed links.
- **HTTP security headers** (HSTS, no framing, no MIME sniffing, strict referrer policy) are set in `next.config.js`.

## Accepted risks

Known advisories that can't be fixed yet are listed, with reasons, in `audit-ci.jsonc`.
