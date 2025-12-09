# Chunk Error Handling

## Problema

Cuando se despliega una nueva versión, clientes con navegadores abiertos pueden fallar al cargar módulos dinámicos si el chunk ya no existe en el servidor.

## Solución

- **ChunkErrorBoundary**: Error Boundary que captura errores y muestra UI amigable
- **ChunkLoadErrorPage**: Página de actualización (`/chunk-load-error`)
- **initSWUpdateListener**: Detecta actualizaciones del Service Worker

## Implementación

Tres archivos nuevos, integrados en `src/main.tsx`:

1. `src/components/ui/ChunkErrorBoundary.tsx` - Captura errores de chunks
2. `src/pages/ChunkLoadErrorPage.tsx` - UI de error amigable
3. `src/lib/swUpdateListener.ts` - Monitor de actualizaciones del SW
