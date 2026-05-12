# Security documentation index

Operational security model for Bioalergia. Each doc covers one
mechanism end to end (what / why / how / activation / references).

| Doc                           | Status   | Standard                                                  |
| ----------------------------- | -------- | --------------------------------------------------------- |
| [audit-log.md](./audit-log.md)         | active  | RFC 6962 §2.1 + HIPAA §164.312(c)(1) + Ley 20.584 Art. 13 |
| [alerting.md](./alerting.md)           | active  | NIST 800-53r5 IR-4(1), AU-6(1) + W3C Push API + RFC 8292   |
| [csp.md](./csp.md)                     | active  | OWASP CSP Cheat Sheet + W3C CSP3 §6.1                      |
| [rls.md](./rls.md)                     | gated   | PostgreSQL §5.9 + HIPAA §164.312(a)(1) + Ley 20.584        |
| [authdb-migration.md](./authdb-migration.md) | rolling | ZenStack v3 policies                                |

Cross-cutting standards followed across the codebase:

- **Auth**: OWASP ASVS 5.0 V2.2 + NIST SP 800-63-4 §5.2.2
  (rate limiting, lockout, constant-time enumeration block).
- **Crypto**: OWASP 2026 — Argon2id m=64MB t=3 password hashing,
  AES-256-GCM at-rest, PASETO V3 sessions.
- **Transport**: HSTS preload, strict CORS allow-list, CSP nonce +
  strict-dynamic + Trusted Types.
- **CSRF**: hono/csrf Origin check + double-submit cookie + cookie
  bootstrap GET.

Backlog (deferred, not yet shipped):

- Nightly Merkle root over `audit_logs.entry_hash` anchored to S3
  Object Lock (compliance mode WORM).
- `pgaudit` extension for PG-side query audit (not available on
  Railway managed PG).
- Column-level encryption on the most sensitive PII (RUT, free-text
  diagnoses) via `pgcrypto.pgp_sym_encrypt`.
- SOC 2 Type II audit prep — runbook for incident response,
  vendor-managed services inventory.
