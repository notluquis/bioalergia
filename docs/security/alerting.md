# Security alerting

## Channel

**Web Push (W3C Push API + VAPID, RFC 8292)** to admin users with a
registered browser subscription. No Slack, no SMTP gateway —
deliberate per `CLAUDE.local.md`.

## Triggers

| Event                                   | Severity | Throttle | Source                          |
| --------------------------------------- | -------- | -------- | ------------------------------- |
| 5 consecutive failed logins (lockout 15 min) | warning  | 1 / hour / user | `lib/account-lockout.ts`     |
| 10 cumulative failed logins (lockout 1 h)    | critical | 1 / hour / user | `lib/account-lockout.ts`     |

Add new triggers by importing `emitSecurityAlert` from
`apps/api/src/lib/security-alerts.ts` and calling it with a stable
`(scope, alertType)` tuple.

## Throttle

Per `(scope, alertType)`, default 1 hour. Stored in the
`security_alert_state` table (mutable; separate from `audit_logs`
which is append-only and immutable). Throttled events still land in
`audit_logs` with kind `LOGIN_LOCKED` so forensics is not lost — only
the operator-facing notification is deduplicated.

## Recipients

Every user with `status = ACTIVE`, role in (`super_admin`, `admin`),
and at least one row in `push_subscriptions`. The list is recomputed
on every alert (no caching) so a freshly-revoked admin loses
notifications instantly.

## What an admin sees

```
🚨 Cuenta bloqueada (usuario 42)
10 intentos fallidos consecutivos — bloqueo de 1 h aplicado.
```

Tapping the notification opens `/admin/security/audit?userId=42` (UI
route reserved; build-out is a separate task).

## Operations

### Onboarding an admin to receive alerts

1. Login from the device/browser they want notifications on.
2. Allow notifications when prompted (the SPA already wires VAPID).
3. Verify with `SELECT user_id, endpoint FROM push_subscriptions
   WHERE user_id = <id>;`.

### Disabling alerts temporarily

There is no global mute. To pause: revoke admin role from the user
(removes from recipient list) or delete their push subscriptions.

### Why no email

Adding SMTP requires either:

- A Gmail send-on-behalf-of integration via the existing Google
  service account (free, but rate limit 500/day, and authentication
  drift if a token revokes), or
- A transactional provider (Resend / AWS SES / Postmark) — paid,
  needs DKIM/DMARC.

Push covers single-admin clinics today. Add SMTP only if the recipient
needs to read alerts when offline of the SPA's PWA — at which point
extend `security-alerts.ts` with a `postEmail` helper alongside the
existing fanout.

## References

- [NIST SP 800-53r5 IR-4(1) Automated Incident Handling](https://csf.tools/reference/nist-sp-800-53/r5/ir/ir-4/ir-4-1/)
- [NIST SP 800-53r5 AU-6(1) Automated Process Integration](https://csf.tools/reference/nist-sp-800-53/r5/au/au-6/au-6-1/)
- [W3C Push API](https://www.w3.org/TR/push-api/)
- [RFC 8292 VAPID](https://www.rfc-editor.org/rfc/rfc8292)
