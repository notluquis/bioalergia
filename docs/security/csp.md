# Content Security Policy (strict CSP, nonce + strict-dynamic + Trusted Types)

## Header

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{R}' 'strict-dynamic' 'unsafe-inline' https:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self';
  media-src 'self' blob:;
  worker-src 'self' blob:;
  manifest-src 'self';
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'self';
  object-src 'none';
  require-trusted-types-for 'script'
```

`{R}` is a per-request UUID Caddy generates via `{http.request.uuid}`.

## Why this exact policy

| Directive                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script-src 'nonce-{R}' 'strict-dynamic'`          | Only scripts carrying the per-request nonce execute. `strict-dynamic` lets nonce-d scripts insert further scripts via DOM (lazy chunks, Vite).                                                                                                                                                                                                                                                                                     |
| `'unsafe-inline' https:` (after `strict-dynamic`)  | Backwards-compat fallback for CSP1/CSP2 browsers — CSP3 browsers ignore both when `strict-dynamic` is present. Documented Google "strict CSP" pattern.                                                                                                                                                                                                                                                                             |
| `style-src 'unsafe-inline'`                        | HeroUI v3 / React Aria emit inline `style="…"` for popovers and overlays — there is no DOM API to attach a nonce to those style attributes. OWASP accepts this trade-off because style-based XSS is dramatically lower impact than script XSS.                                                                                                                                                                                     |
| `frame-ancestors 'none'`                           | Anti-clickjacking; supersedes `X-Frame-Options: DENY` (kept for old browsers).                                                                                                                                                                                                                                                                                                                                                     |
| `base-uri 'none'`                                  | Blocks `<base href>` tag injection that could redirect relative URLs.                                                                                                                                                                                                                                                                                                                                                              |
| `object-src 'none'`                                | Blocks Flash / `<embed>` / `<object>`.                                                                                                                                                                                                                                                                                                                                                                                             |
| `require-trusted-types-for 'script'` (REPORT-ONLY) | Forces all DOM sinks (innerHTML etc.) to receive Trusted Types objects. React 19 has built-in support. Currently shipped in `Content-Security-Policy-Report-Only` — Cloudflare Bot Fight Mode and similar edge-injected scripts use `innerHTML` / `.src` assignment that violates Trusted Types regardless of nonce. Track violations and flip to enforce after auditing first-party code + disabling CF script-injection modules. |

## How the nonce gets there

1. **Build (Vite)**: `vite.config.ts` registers a `cspNoncePlugin` that, in
   `transformIndexHtml`, walks every `<script>` and `<link rel="stylesheet">`
   in the built `index.html` and prepends
   `nonce="{{ placeholder "http.request.uuid" }}"` if the tag does not
   already carry a nonce.

2. **Serve (Caddy)**: the `handle { templates; file_server }` block parses
   `index.html` as a Go template. The `placeholder` template function
   resolves `{{ placeholder "http.request.uuid" }}` to the same UUID Caddy
   substitutes into `{http.request.uuid}` in the `Content-Security-Policy`
   header. Both values are identical for the same request.

3. **Browser**: every script tag now carries `nonce="<uuid>"` and the CSP
   header allows exactly that nonce. Lazy-loaded chunks inserted by Vite
   inherit the privilege via `'strict-dynamic'`.

Performance: per-request UUID generation + 1 small HTML template render.
Sub-millisecond on Caddy.

## Local development

`vite dev` does not go through Caddy. The dev server serves
`index.html` directly with the literal placeholder string in the nonce
attributes; the browser will report CSP errors only if you ALSO run
the production CSP header. The dev server is configured to NOT emit the
strict header so HMR works normally.

To preview production CSP locally:

```bash
pnpm -F @finanzas/intranet build
cd apps/intranet/dist
caddy file-server --listen :3000
# then point a Caddy with the project Caddyfile at this dist
```

## When something is blocked

CSP violations land in the browser DevTools console, not in server logs.
If we add `report-to` later they will also POST to a CSP reporting
endpoint — currently disabled to keep the policy stateless.

Common breakages:

- **Adding a CDN script tag** → must come from the same origin OR be
  loaded by a script that already has the nonce (`strict-dynamic`
  handles this). Static `<script src="https://cdn..."></script>`
  without a nonce will be blocked.
- **Adding inline `onclick="…"` handlers** → blocked. Use
  `addEventListener` from a nonce-d script.
- **Adding `eval()` or `new Function(…)`** → blocked. There is no
  `'unsafe-eval'`. React 19 + Vite production builds do not need it.

## References

- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [W3C Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [web.dev Strict CSP](https://web.dev/articles/strict-csp)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [MDN require-trusted-types-for](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for)
- [Caddy `templates` directive](https://caddyserver.com/docs/caddyfile/directives/templates)
