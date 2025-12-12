# CLAUDE.md — finanzas-app

> Instrucciones específicas para Claude (Anthropic) trabajando en este repositorio.

## Contexto del proyecto

Sistema de gestión médica/financiera para clínica de alergias (Bioalergia). 
Stack: React + Vite (frontend), Node + Express + Prisma + **PostgreSQL** (backend).

## Lo más importante

1. **Base de datos es PostgreSQL**, NO MySQL
   - Usar `TO_CHAR()` en vez de `DATE_FORMAT()`
   - Usar `EXTRACT()` para partes de fechas
   - Nombres de tablas según `@@map` en schema.prisma

2. **Estilos con DaisyUI**
   - ✅ `bg-base-100`, `text-base-content`, `card`
   - ❌ `bg-white`, `text-gray-900`, colores hex

3. **Verificar antes de responder**
   - Buscar APIs existentes en `src/features/*/api.ts`
   - Buscar hooks existentes en `src/features/*/hooks/`
   - No duplicar código que ya existe

## Comandos frecuentes

```bash
npm run dev:full     # Desarrollo completo
npm run type-check   # Verificar tipos (obligatorio)
npm run build        # Build producción
```

## Archivos clave

- `AGENTS.md` — Documentación completa para agentes IA
- `server/config.ts` — Configuración sesiones, JWT, calendar
- `prisma/schema.prisma` — Schema BD (revisar `@@map`)
- `src/main.tsx` — Entry point y rutas

## Errores frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `function date_format does not exist` | Usando MySQL syntax | Usar `TO_CHAR()` |
| Tab no se marca activo | Falta `end: true` | Agregar a TabItem |
| Dark mode roto | Usando `bg-white` | Usar `bg-base-100` |

## Reglas de seguridad

- NO eliminar endpoints legacy sin verificar callers
- NO cambiar session duration (24h) sin aprobación
- NO modificar migraciones ya deployadas
- SIEMPRE preservar shape de respuestas: `{ inserted, updated, skipped, total }`

## Para más detalle

Ver `AGENTS.md` en la raíz del proyecto — contiene instrucciones completas.
