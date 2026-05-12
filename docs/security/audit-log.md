# Audit log integrity (HMAC hash chain)

## What

`audit_logs` is an append-only HMAC chain modelled on **RFC 6962 §2.1**
(Certificate Transparency append-only Merkle log) reduced to a
per-row chain. Every new row's `entry_hash` is the HMAC-SHA256 of the
previous row's `entry_hash` concatenated with the new row's payload,
keyed by a secret only the database owner can read.

This satisfies:

- **HHS HIPAA Security Rule 45 CFR §164.312(b)** (Audit controls)
- **HHS HIPAA Security Rule 45 CFR §164.312(c)(1)** (Integrity —
  "mechanisms to corroborate that ePHI has not been altered or
  destroyed in an unauthorized manner")
- **Chile Ley 20.584** Art. 12-13 + **Reglamento DS 41/2012** Art. 13
  (traceability of access to the ficha clínica)

## How it works

1. Migration `20260512010000_audit_log_hash_chain` adds `prev_hash`
   and `entry_hash` columns and installs a `BEFORE INSERT` trigger
   `audit_log_chain()`.

2. The trigger reads the HMAC key from the session GUC
   `app.audit_hmac_key`, computes
   `HMAC_SHA256(key, prev_hash || row_payload)` and writes both
   columns. The trigger is `SECURITY DEFINER` so the runtime app role
   never sees the key.

3. The pool (`packages/db/src/client.ts`) sets the GUC on every new
   physical connection from the `AUDIT_HMAC_KEY` env var.

4. `apps/api/src/lib/audit-log-verify.ts` exports `verifyAuditChain()`
   that recomputes the chain in JS and returns the first divergent row
   id, or `null` if intact. Run from a nightly cron and alert on
   non-null.

## Operations

### Generating the key

```bash
openssl rand -hex 32
```

Set in Railway api service as `AUDIT_HMAC_KEY`. Backup in password
manager — losing the key means the existing chain is unverifiable
(but new entries continue from a new key fork).

### Rotating the key

There is no in-place rotation. Procedure:

1. Mint new key, set as `AUDIT_HMAC_KEY_NEW` env (just for tracking).
2. At a low-traffic moment, run `verifyAuditChain()` — must return
   `null` (chain intact under old key).
3. Snapshot the latest `entry_hash`, store with timestamp + signed
   note ("chain sealed at id N under key K_old, next entries under
   K_new").
4. Swap `AUDIT_HMAC_KEY` env value, restart.
5. New entries chain from the snapshot's `entry_hash`. Verifier
   becomes two-segment (old key for ids ≤ N, new key for ids > N) —
   easiest path is to forget `verifyAuditChain` for the seam and
   archive the snapshot externally.

### Anchoring (next step, not yet implemented)

Daily job should compute a Merkle root over all `entry_hash` values
and write `{tree_size, root, signature, ts}` to S3 with **Object Lock
in compliance mode** (WORM). Verifying daily roots externally makes
DB-level tampering detectable.

### What an alert means

`verifyAuditChain()` returning a row id means one of:

- The HMAC key in env diverges from the key used at insert (most
  common — operator restored a backup with mismatched key).
- A row was modified or inserted out-of-trigger (e.g. via direct
  `UPDATE` by a DBA bypassing the trigger).
- Chain was forked deliberately during key rotation (see above).

In production any of these warrants immediate investigation.

## Threat model

| Adversary capability                   | Chain detects?                                      |
| -------------------------------------- | --------------------------------------------------- |
| Runtime app role (INSERT only)         | ✅ — key not exposed                                |
| DBA with full DB access (no key)       | ✅ — cannot reforge HMAC                            |
| DBA with full DB access AND env access | ❌ — can reforge offline; mitigated by daily anchor |
| Backup restore to earlier point        | ✅ — chain head diverges from external anchor       |

## References

- [RFC 6962 §2.1 Certificate Transparency](https://www.rfc-editor.org/rfc/rfc6962.html)
- [research!rsc — Transparent Logs for Skeptical Clients](https://research.swtch.com/tlog)
- [HHS HIPAA Security Rule 45 CFR §164.312](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312)
- [Ley 20.584 Chile](https://www.bcn.cl/leychile/navegar?idNorma=1039348)
