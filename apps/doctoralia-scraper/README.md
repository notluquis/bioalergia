# @finanzas/doctoralia-scraper

Full-auto Doctoralia calendar scraper. **Sin browser**: usa
[IMPIT](https://github.com/apify/impit) (Rust, 0 dependencias, browser TLS
impersonation built-in). ~5MB de overhead, corre en segundos.

## Por qué IMPIT vs Playwright/Patchright

| | IMPIT | Patchright |
|---|---|---|
| Tamaño | ~5MB | 1.5GB (Chromium) |
| RAM | ~50MB | ~500MB |
| Tiempo por corrida | segundos | minutos |
| Dependencias runtime | 0 | Chromium + ~30 libs |
| TLS fingerprint | Chrome real (Rust + rustls) | Chromium real (pesado) |

Solo downside: login por form se hace via POST manual (no JS). Si Doctoralia
mete reCAPTCHA en login, caemos y reintroducimos Patchright como fallback.

## Variables

Desde `/.env` de la raíz:

```
DOCTORALIA_SCRAPER_BASE_URL=https://docplanner.doctoralia.cl
DOCTORALIA_SCRAPER_EMAIL=...
DOCTORALIA_SCRAPER_PASSWORD=...
DOCTORALIA_SCRAPER_IMPORT_ENDPOINT=http://localhost:4000/rpc/doctoralia.importCalendarJson
DOCTORALIA_SCRAPER_IMPORT_TOKEN=
```

## Primera corrida — modo discover

Antes de intentar login a ciegas, dumpeamos la página de login para ver el form
real (action, campos ocultos, CSRF, nombres de inputs):

```bash
pnpm --filter @finanzas/doctoralia-scraper discover
```

Esto genera `captures/login-page.html`. Se comparte conmigo y adapto el código.

## Scrape normal

```bash
pnpm --filter @finanzas/doctoralia-scraper scrape
```

Flujo:
1. Carga cookies de `.cookies.json` (si existe).
2. GET al panel. Si hay sesión → directo a paso 4.
3. Si pide login: parsea el form, POSTea credenciales. Si pide OTP, lee el código por stdin.
4. GET a `/api/calendarevents?from=...&to=...` (probamos 3 paths).
5. Guarda en `captures/calendarevents_<ts>.json`.
6. Si `DOCTORALIA_SCRAPER_IMPORT_ENDPOINT` está seteado, POSTea al API.

## Cookies persistidas

`.cookies.json` se actualiza después de cada corrida. Si expira la sesión, el
script detecta el redirect a `l.doctoralia.cl` y relogea automáticamente.

## Deploy a Railway (pendiente)

Imagen `node:25-slim` (base existente), sin Chromium. Dockerfile ~15 líneas.
Railway cron service → ~$0.01/mes.
