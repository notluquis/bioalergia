# Local Mail Agent (macOS)

Agente local para enviar emails desde tu Mac usando SMTP (Spacemail) y payload estructurado.

## Requisitos
- macOS
- Node.js (usa el mismo del repo)
- Keychain configurado

## Configurar Keychain

```bash
security add-generic-password -s "bioalergia-local-mail-agent" -a "smtp_user" -w "lpulgar@bioalergia.cl"
security add-generic-password -s "bioalergia-local-mail-agent" -a "smtp_pass" -w "<TU_PASSWORD>"
security add-generic-password -s "bioalergia-local-mail-agent" -a "agent_token" -w "<TOKEN_LOCAL>"
```

## Ejecutar

```bash
pnpm --filter @finanzas/local-mail-agent dev
```

Por defecto escucha en `http://127.0.0.1:3333`. Puedes cambiar el puerto con `PORT=4444`.

## HTTPS local (recomendado para usar desde intranet HTTPS)

Los navegadores bloquean requests HTTP desde páginas HTTPS. Para evitarlo, usa HTTPS local.

1) Genera certificado local (ejemplo con `mkcert`):

```bash
mkcert -install
mkcert 127.0.0.1 localhost
```

2) Arranca el agente con TLS:

```bash
LOCAL_AGENT_TLS_KEY_PATH=\"./127.0.0.1+1-key.pem\" \\\nLOCAL_AGENT_TLS_CERT_PATH=\"./127.0.0.1+1.pem\" \\\nPORT=3333 \\\npnpm --filter @finanzas/local-mail-agent dev
```

Luego en la intranet usa `https://127.0.0.1:3333`.

## CORS

Puedes permitir orígenes adicionales con:

```bash
LOCAL_AGENT_ALLOWED_ORIGINS="https://intranet.bioalergia.cl,http://localhost" pnpm --filter @finanzas/local-mail-agent dev
```
