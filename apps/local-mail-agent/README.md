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
LOCAL_AGENT_TLS_KEY_PATH="./127.0.0.1+1-key.pem" \
LOCAL_AGENT_TLS_CERT_PATH="./127.0.0.1+1.pem" \
PORT=3333 \
pnpm --filter @finanzas/local-mail-agent dev
```

Luego en la intranet usa `https://127.0.0.1:3333`.

## Comandos rápidos (desde la raíz del repo)

```bash
pnpm mail:start
pnpm mail:status
pnpm mail:stop
pnpm mail:logs
```

## CORS

Puedes permitir orígenes adicionales con:

```bash
LOCAL_AGENT_ALLOWED_ORIGINS="https://intranet.bioalergia.cl,http://localhost" pnpm --filter @finanzas/local-mail-agent dev
```

## Verificación SMTP

El agente expone un chequeo de conectividad SMTP con auth:

```bash
curl -k -H "X-Local-Agent-Token: <TOKEN_LOCAL>" https://127.0.0.1:3333/health/smtp
```

Respuesta esperada:

```json
{"status":"ok","smtp":"ready"}
```

También expone configuración activa (sin secretos):

```bash
curl -k https://127.0.0.1:3333/health/config
```

Apagado remoto (requiere token):

```bash
curl -k -X POST -H "X-Local-Agent-Token: <TOKEN_LOCAL>" https://127.0.0.1:3333/shutdown
```

## Test de envío a tu mismo correo

Este comando hace `verify()` y envía un correo de prueba desde `smtp_user` hacia `smtp_user`:

```bash
pnpm --filter @finanzas/local-mail-agent test:send-self
```

## Guardar en Sent (IMAP APPEND)

Después de enviar por SMTP, el agente intenta guardar la copia en carpeta `Sent` usando IMAP `APPEND` (RFC822).

Variables opcionales:

- `LOCAL_AGENT_IMAP_HOST` (default: `mail.spacemail.com`)
- `LOCAL_AGENT_IMAP_PORT` (default: `993`)
- `LOCAL_AGENT_IMAP_SECURE` (default: `1`)
- `LOCAL_AGENT_IMAP_SENT_MAILBOX` (si quieres forzar carpeta, por ejemplo `Sent`)

## Flags opcionales

- `LOCAL_AGENT_SMTP_POOL=1` habilita pool SMTP.
- `LOCAL_AGENT_SMTP_MAX_CONNECTIONS=2` conexiones máximas del pool.
- `LOCAL_AGENT_SMTP_MAX_MESSAGES=50` mensajes por conexión del pool.
- `LOCAL_AGENT_SMTP_DEBUG=1` logs SMTP detallados.
- `LOCAL_AGENT_DSN_ENABLED=1` adjunta DSN en `sendMail` (`failure`,`delay`).
