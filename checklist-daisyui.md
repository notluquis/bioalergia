
# Checklist unificada de Integración (daisyUI)

Esta checklist unifica las verificaciones relevantes para migrar la UI del proyecto a `daisyUI`. Se han incorporado las comprobaciones generales que estaban en el checklist de Flowbite pero adaptadas a daisyUI — el proyecto usará únicamente daisyUI.

Cada PR que migre o añada componentes UI debe usar esta checklist y marcar cada ítem antes de mergear.

## Verificación Inicial
- [ ] Verificar que `tailwind.config.cjs` incluya `require("daisyui")` en `plugins`.
- [ ] Verificar que `daisyui` está en `package.json` (devDependencies) con la versión esperada, sin conflictos.
- [ ] Ejecutar `npm run build` del frontend y confirmar que no hay errores después de los cambios.

## CSS y Configuración
- [ ] En el archivo CSS principal (por ejemplo `src/index.css`) añadir `@plugin "daisyui";` o asegurar que el pipeline de Tailwind aplica daisyUI.
- [ ] Confirmar que `tailwind.config.cjs` mantiene tus variables de marca (`--brand-primary`, `--brand-secondary`) y que los temas de daisyUI no las sobreescriben inesperadamente.
- [ ] Si usas temas de daisyUI, validar que el tema seleccionado respeta el branding o que se definió un tema personalizado acorde.

## Para Cada Componente Migrado
- [ ] Usar clases de daisyUI apropiadas (por ejemplo `btn btn-primary`, `card`, `modal`) en lugar de duplicar utilidades manuales cuando aplica.
- [ ] Mantener la lógica de negocio: props, handlers, hooks y contratos TypeScript sin cambios funcionales indeseados.
- [ ] Aplicar branding: si usas variables CSS (`--brand-primary`, etc.), confirmarlas en el componente nuevo (via `className`, variables de tema o overrides).
- [ ] Evitar duplicación de estilos: no añadir utilidades manuales que ya gestiona daisyUI.
- [ ] Probar responsive (mobile / tablet / desktop) y comportamiento interactivo (focus, hover, disabled).
- [ ] Verificar visibilidad y comportamiento según roles (GOD, ADMIN, ANALYST, VIEWER) cuando aplique.

## Layouts y Navegación
- [ ] Verificar que `Navbar`, `Sidebar` y otros elementos del layout se integran con daisyUI o con tus utilidades personalizadas (por ejemplo `.glass-panel`).
- [ ] Confirmar que `NAV_SECTIONS` sigue filtrando correctamente menús por rol y que los componentes migrados respetan la visibilidad basada en roles.
- [ ] Comprobar que la navegación y las llamadas a `/api/*` siguen funcionando (proxy de desarrollo y configuración de producción no afectada por cambios de UI).

## Retiro de Estilos Legacy
- [ ] Si se eliminan clases/archivos CSS legacy, hacerlo en pasos y validar visualmente tras cada cambio.
- [ ] Ejecutar pruebas visuales/regresivas (snapshots, revisión manual) para detectar regresiones antes de eliminar estilos.

## Build, Tests y Documentación
- [ ] `npm run build` debe completarse sin errores.
- [ ] Ejecutar pruebas unitarias/integración relevantes (si aplican) y revisiones visuales.
- [ ] Actualizar README o wiki: anotar que el proyecto usa `daisyUI`, versión y directrices básicas de uso.
- [ ] Añadir guía rápida para crear nuevos componentes con daisyUI y cómo aplicar overrides/branding.

## Consideraciones de Diseño
- [ ] Mantener el efecto `glass-morphism` aplicando la clase `.glass-panel` junto a las clases de daisyUI cuando sea necesario. Documentar el pattern para usarlo con daisyUI.
- [ ] Priorizar migración de componentes de alto uso (botones, formularios, modals) y planear migración incremental del resto.

## Checklist final antes de merge
- [ ] Revisar que no queden referencias a Flowbite o archivos de configuración relacionados.
- [ ] Confirmar que `package.json` no contiene dependencias redundantes.
- [ ] Añadir nota en el PR describiendo qué componentes fueron migrados y si se eliminaron estilos legacy.

---

Archivo actualizado: `checklist-daisyui.md` (unificado — ahora la fuente de verdad para PRs sobre UI usando daisyUI).
