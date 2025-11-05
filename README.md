# 🏦 Finanzas App

React + Vite + TypeScript + **Tailwind v4**. Sistema completo de gestión financiera para Bioalergia con Express + MySQL backend, autenticación con roles y panel moderno tematizable.

## 🚀 Scripts de Desarrollo

```bash
# Desarrollo
npm run dev:full      # Frontend + Backend en paralelo (recomendado)
npm run dev           # Solo frontend (Vite)
npm run server        # Solo backend (Express) - logs formateados automáticamente

# Producción
npm run prod          # Build completo + start
npm run deploy        # Build y prune de dependencias (producción)
npm start             # Solo start (requiere build previo)

# Calidad
npm run lint          # ESLint sobre TS/TSX/JS
npm run type-check    # tsc --noEmit

# Seguridad
npm run security:check    # Auditoría de seguridad
npm run env:encrypt      # Encriptar variables para producción
npm run prod:secure      # Producción con encriptación
```

## ✅ Pre-commit

Usamos Husky + lint-staged. Cada commit corre automáticamente:

```bash
npx lint-staged
```

## 🔐 Seguridad y Variables de Entorno

⚠️ **Importante**: Los secretos se gestionan desde Railway → Variables. Usa scopes por entorno (Production/Staging/Preview) y variable groups para compartir claves entre servicios.

### Configuración local

1. Copia `.env.example` a `.env` **solo para desarrollo** y rellena con valores dummy si es necesario.
2. Carga los valores reales en Railway; evita sincronizar `.env` reales con el repo.
3. Para producción, usa `npx @dotenvx/dotenvx encrypt` si necesitas vault local, pero prioriza los secretos de Railway.

### Medidas de Seguridad

- ✅ Hook de pre-commit que previene subir secrets
- ✅ Variables encriptadas para producción con dotenvx
- ✅ Auditoría automática de dependencias
- ✅ Guía de despliegue en Railway en `docs/railway-deployment.md`
- ✅ Documentación de seguridad detallada en `docs/SECURITY.md`

## 🏗️ Arquitectura

- Tailwind v4 se integra con `@tailwindcss/vite`. No se requiere `tailwind.config` ni `postcss.config` para el caso base.
- Para Excel se usa `exceljs`. Prefiere CSV cuando sea posible con `papaparse`.
- Los reportes de Mercado Pago se manejan en `src/mp/reports.ts`. El parser autodetecta separadores `,`, `;` o `|`; si necesitas casos más complejos, considera integrar Papa Parse.
- El flujo manual (`/report`) permite fijar el saldo inicial y revisar la tabla consolidada con columnas Fecha / Descripción / Desde / Hacia / Tipo / Monto / Saldo cuenta.
- Los colores, logo, correos y metadatos de referencia se guardan en la tabla `settings` y se gestionan desde la página **Configuración** (`/settings`).

## Backend (Express + MySQL)

- Variables de entorno en `.env` (ver `.env.example`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- En el primer arranque, si la tabla `users` está vacía y `ADMIN_EMAIL`/`ADMIN_PASSWORD` están definidos, se crea automáticamente un usuario con rol **GOD**.
- Ejecuta `npm run server` para levantar la API (por defecto en `http://localhost:4000`).
- Ejecuta `npm run dev` para levantar el front; `/api` se proxyea automáticamente al servidor Express.
- **Logging**: Los logs se formatean automáticamente en desarrollo con colores y timestamps legibles usando `pino-pretty`. En producción se mantiene formato JSON estructurado.
- Endpoints principales:
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` → manejo de sesión vía cookie HTTP-only.
  - `GET /api/settings`, `PUT /api/settings` → lectura y actualización de la configuración de marca (requiere rol `ADMIN` o `GOD`).
  - `POST /api/transactions/upload` → recibe un CSV, lo parsea y lo inserta en la tabla `mp_transactions` (se crea automáticamente si no existe).
  - `GET /api/transactions` → devuelve los movimientos guardados (ordenados por fecha).
- Para compilar el backend ejecuta `npm run build:server`; la salida queda en `dist/server` y se puede iniciar con `npm run start:server`.

## Vistas

- `/` → Resumen y accesos rápidos.
- `/report` → Vista local para analizar CSV sin cargarlo a la base.
- `/upload` → Subir CSV a la base de datos.
- `/data` → Consultar los movimientos almacenados en MySQL con saldo acumulado configurable.
- `/settings` → Editar branding (colores, logo, tagline), datos de contacto y referencias de la base.
- `/login` → Acceso con correo corporativo y contraseña; los roles controlan qué secciones están visibles (por ahora: `VIEWER`, `ANALYST`, `ADMIN`, `GOD`).
