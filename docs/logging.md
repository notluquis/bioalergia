# Logging

Los logs del servidor usan Pino con pretty printing automático en desarrollo:

```bash
# En desarrollo (npm run server)
[2025-11-02 14:54:32.155 -0300] INFO: [server]
    tag: "transactions/stats"
    method: "GET"
    path: "/api/transactions/stats"
    ip: "::1"
    requestId: "a114be1c-6a27-4b25-b6bb-6332c8003596"
    userId: 1
    email: "user@example.com"
    from: "2025-08-01 00:00:00"
    to: "2025-11-02 23:59:59"

# En producción (JSON estructurado)
{"level":30,"time":1762105880803,"requestId":"...","method":"GET","url":"/api/transactions/stats","event":"request:start"}
```

## Configuración

- **Desarrollo**: Logs coloreados y formateados con timestamps legibles
- **Producción**: JSON estructurado para herramientas de logging (Railway, Logtail, etc.)
- **Variables**: `LOG_LEVEL` (default: "info") y `NODE_ENV` controlan el formato

## Uso en código

````typescript
import { logger } from './lib/logger';

// Log estructurado
logger.info({
  tag: 'transactions/stats',
  userId: 1,
  filters: { from, to }
});

// Con contexto de request
const log = getRequestLogger(req);
log.info({ event: 'request:complete', statusCode: 200 });
```</content>
<parameter name="filePath">/Users/notluquis/finanzas-app/docs/logging.md
````
