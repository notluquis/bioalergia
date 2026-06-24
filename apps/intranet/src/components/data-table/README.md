# Tablas y paginación (estilo único)

**Toda superficie tabular (filas × columnas) usa `DataTable`** (`@/components/data-table/DataTable`).
No usar `<Table>`/`Table.*` de HeroUI a mano en features/pages — el `DataTable`
(TanStack headless + HeroUI v3 en la capa visual) ya resuelve orden, visibilidad/pin
de columnas, filtrado, export CSV, virtualización, skeletons y estado vacío.

## Definir una tabla

```tsx
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Nombre" },
  { id: "actions", header: "", cell: ({ row }) => <RowActions row={row.original} /> },
];

<DataTable columns={columns} data={rows} isLoading={isPending} noDataMessage="Sin datos." />;
```

- Filtros/búsqueda custom: déjalos **arriba** de la tabla y pasa la data ya filtrada a `data`.
- Acciones por fila: columna `id: "actions"` con botones icon-only HeroUI (espejar `features/job-radar/pages/JobRadarPage.tsx`).
- Extracción de tipo de fila: `(typeof rows)[number]` si hace falta.

## Convención de paginación

| Caso                                                | Cómo                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client-side** (dataset chico ya cargado)          | Default del `DataTable` (no pasar props de paginación).                                                                                               |
| **Server-side** (query con `limit`/`offset`/`page`) | Pasar `pagination` + `onPaginationChange` + `pageCount` (activa `manualPagination`). Espejar `features/finance/components/CashFlowTable.tsx`.         |
| **Estática chica** (schedules, summaries)           | `enablePagination={false}`.                                                                                                                           |
| **Cursor / infinite**                               | Acumular con `useInfiniteQuery` afuera; `DataTable` con `enablePagination={false}` renderiza las filas; el botón "Cargar más" va fuera del DataTable. |

## Paginación fuera de tablas (grids de cards, etc.)

Usar `AppPagination` (`@/components/pagination/AppPagination`) — único componente
de paginación HeroUI de la app. Contrato **0-based** en `page`/`onPageChange`.
`DataTablePagination` lo consume internamente; no existe otro componente de
paginación (la antigua `ClassificationPagination` fue eliminada).

> **Gotcha**: nunca llamar `table.getRowModel()` dentro de un componente que
> recibe `table` por prop — el row model queda stale. Computarlo donde vive
> `useReactTable`. Ver `DataTable.pagination.test.tsx`.

## Excepción: editores de texto libre por fila

Los `<input>`/`<TextArea>` editables **dentro de una celda** del DataTable NO
funcionan: la `<Table>` de HeroUI (React-Aria, role grid) remonta el contenido de
la celda en cada re-render y el campo pierde el valor/foco en cada tecla. Botones,
chips, links y selects sí funcionan en celdas. Para tablas cuyo caso de uso es
editar texto libre por fila (ej. `exam-reports/AllergensTagsPanel`), mantener una
`<Table>` a mano es la opción correcta — es la única excepción permitida.
