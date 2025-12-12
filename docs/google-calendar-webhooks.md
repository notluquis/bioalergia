# Google Calendar Push Notifications (Webhooks)

## Resumen

Google Calendar API ofrece **Push Notifications** que permiten recibir notificaciones en tiempo real cuando hay cambios en los eventos de un calendario, eliminando la necesidad de polling periódico (sync cada 15 minutos).

## ¿Cómo funciona?

1. **Registrar un watch channel**: POST a `/calendars/{calendarId}/events/watch`
2. **Google envía notificaciones**: Cuando hay cambios, Google hace POST a tu URL webhook
3. **Tu servidor procesa**: Al recibir notificación, ejecutas `syncCalendarEvents()`
4. **Renovar channel**: Los channels expiran (máximo 7 días), necesitas renovarlos antes

## Requisitos

- ✅ **URL pública con HTTPS**: Railway provee esto automáticamente
- ✅ **Certificado SSL válido**: Railway lo maneja
- ⚠️ **Endpoint webhook**: Necesitas implementar POST `/api/calendar/webhook`
- ⚠️ **Estado del channel**: DB table para almacenar channel ID y expiration
- ⚠️ **Auto-renovación**: Cron job o scheduler para renovar antes de expiración

## Implementación propuesta

### 1. Backend: Endpoint webhook

```typescript
// server/routes/calendar-events.ts
router.post("/webhook", async (req, res) => {
  const channelId = req.headers["x-goog-channel-id"];
  const resourceId = req.headers["x-goog-resource-id"];
  const resourceState = req.headers["x-goog-resource-state"];

  // Verificar que el channel es válido
  const channel = await prisma.calendarWatchChannel.findUnique({
    where: { channelId },
  });

  if (!channel) {
    return res.status(404).send("Unknown channel");
  }

  // Si es "sync", ignorar (primera notificación al crear channel)
  if (resourceState === "sync") {
    return res.status(200).send("OK");
  }

  // Si hay cambios, triggear sync asíncrono
  if (resourceState === "exists") {
    // Agregar job a cola de sync (evita bloquear response)
    await queueCalendarSync({
      triggerSource: "WEBHOOK",
      triggerLabel: "Google Calendar Push Notification",
    });
  }

  res.status(200).send("OK");
});
```

### 2. Registrar watch channel

```typescript
// server/lib/google-calendar.ts
import { v4 as uuidv4 } from "uuid";

async function registerWatchChannel(calendarId: string) {
  const channelId = uuidv4();
  const webhookUrl = `${process.env.PUBLIC_URL}/api/calendar/webhook`;

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      token: process.env.WEBHOOK_SECRET, // Para validar
      // expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días
    },
  });

  // Guardar en DB
  await prisma.calendarWatchChannel.create({
    data: {
      channelId: response.data.id!,
      resourceId: response.data.resourceId!,
      calendarId,
      expiration: new Date(Number(response.data.expiration)),
      webhookUrl,
    },
  });

  return response.data;
}
```

### 3. Schema Prisma para channels

```prisma
model CalendarWatchChannel {
  id          Int      @id @default(autoincrement())
  channelId   String   @unique
  resourceId  String
  calendarId  String
  expiration  DateTime
  webhookUrl  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("calendar_watch_channels")
}
```

### 4. Auto-renovación de channels

```typescript
// server/lib/google-calendar-scheduler.ts
import cron from "node-cron";

// Cada día, revisar channels que expiran en <2 días
cron.schedule("0 0 * * *", async () => {
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  const expiringChannels = await prisma.calendarWatchChannel.findMany({
    where: {
      expiration: {
        lte: twoDaysFromNow,
      },
    },
  });

  for (const channel of expiringChannels) {
    try {
      // Stop old channel
      await calendar.channels.stop({
        requestBody: {
          id: channel.channelId,
          resourceId: channel.resourceId,
        },
      });

      // Create new channel
      await registerWatchChannel(channel.calendarId);

      // Delete old from DB
      await prisma.calendarWatchChannel.delete({
        where: { id: channel.id },
      });

      console.log(`✓ Renewed watch channel for calendar ${channel.calendarId}`);
    } catch (error) {
      console.error(`✗ Failed to renew channel ${channel.channelId}:`, error);
    }
  }
});
```

## Beneficios

- ⚡ **Sync en tiempo real**: Eventos se sincronizan solo cuando hay cambios
- 💰 **Reducción de cuota API**: No más polling cada 15 minutos
- 🔋 **Menor carga del servidor**: No consultas periódicas innecesarias
- ⏱️ **Latencia baja**: Cambios reflejados en <10 segundos

## Desventajas

- 🛠️ **Complejidad**: Requiere manejo de estado de channels, renovación, etc.
- 🔄 **Mantenimiento**: Necesitas monitorear expiración y renovar
- 🌐 **Dependencia de webhooks**: Si Google no puede alcanzar tu URL, pierdes notificaciones
- ⚠️ **Debugging**: Notificaciones son asíncronas, más difícil de testear

## Recomendación

**Para MVP/actual**: Mantener polling cada 15 minutos (simple, funciona).

**Para v2/escalabilidad**: Implementar webhooks cuando:

- Tengas >100 usuarios activos
- El polling cause problemas de cuota API
- Necesites sync <5 minutos de latencia

## Recursos

- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Watch Events Endpoint](https://developers.google.com/workspace/calendar/api/v3/reference/events/watch)
- [Managing Channels](https://developers.google.com/workspace/calendar/api/guides/push#managing-channels)

## Variables de entorno necesarias

```env
PUBLIC_URL=https://finanzas-app.up.railway.app
WEBHOOK_SECRET=your-secret-token-here
```

## Migration SQL

```sql
CREATE TABLE calendar_watch_channels (
  id SERIAL PRIMARY KEY,
  channel_id TEXT UNIQUE NOT NULL,
  resource_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  expiration TIMESTAMP NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_watch_channels_expiration ON calendar_watch_channels(expiration);
CREATE INDEX idx_calendar_watch_channels_calendar_id ON calendar_watch_channels(calendar_id);
```

## Notas adicionales

- Las notificaciones NO incluyen qué cambió, solo que "algo cambió" - siempre debes hacer sync completo
- Puedes watch múltiples calendarios con channels separados
- Google recomienda no exceder 100 channels activos por proyecto
- Las notificaciones pueden llegar con delay (normalmente <10s, pero no garantizado)
- Necesitas responder 200 OK rápido (<30s) o Google puede deshabilitar el channel
