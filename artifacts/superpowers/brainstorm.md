# Brainstorm: Frontend-First Financial Dashboard

## Goal
Develop the **Frontend UI** for a centralized Financial Dashboard.
1.  **Incomes**: Visualize real income data derived exclusively from **Calendar Events**.
2.  **Expenses (Outcomes)**: UI Layout/Skeleton only (to be connected to API later).

## Constraints
-   **No New Models**: Do not create generic `Expense` tables yet.
-   **No MercadoPago**: Explicitly separate from MP logic.
-   **Granularity**: View data by Day, Week, and Month.
-   **Income Hierarchy**:
    -   **Category**: High-level grouping (e.g., Treatments, Exams).
    -   **Items**: Specific service instances (e.g., "Subcutaneous Treatment", "Prick Test").
-   **Source of Truth**: `Event` table (`amountExpected`/`amountPaid`).

## Known context
-   **Data Source**: `Event` table contains `eventType`, `summary`, `amountPaid`.
-   **Keywords**: User specifically requested segmentation by:
    -   "Tratamiento Subcutáneo"
    -   "Test" (Prick/Patch)
    -   "Exámenes"
-   **Status**: `Expenses` are out of scope for backend logic in this iteration.

## Risks
-   **Dirty Data**: "Subcutaneous" or "Test" might need regex matching on `Event.summary` if not strictly categorized in `eventType`.
-   **Zero Values**: Events without `amountPaid` will show as $0 income even if performed.

## Options

### Option 1: Frontend Aggregation (Selected)
-   Fetch all Events for the selected period.
-   Client-side mapping: `Event` -> `IncomeItem`.
-   Group by Regex/Category logic in TypeScript.
-   **Pros**: Fast iteration, easy to tweak matching logic without DB migrations.

## Recommendation
**Option 1 (Frontend Aggregation)**.
Build a generic `FinancialDashboardPage`:
1.  **Date Control**: Reuse existing Day/Week/Month pickers.
2.  **Income Section**:
    -   Query `useFindManyEvent`.
    -   **Logic**: Map `event.summary` or `event.eventType` to categories ("Tratamientos", "Exámenes").
    -   **Display**: Accordion or Grouped Tables showing total per category and list of specific items.
3.  **Outcome Section**:
    -   Static Placeholder / Skeleton UI showing where expenses will go.

## Acceptance criteria
-   [ ] UI: `features/finance/pages/FinancialDashboardPage.tsx` created.
-   [ ] Logic: `useFinancialSummary` hook that:
    -   Fetches Events for date range.
    -   Filters/Groups them into "Incomes" structure.
-   [ ] View: Display Incomes grouped by Category -> Subcategory.
-   [ ] View: Placeholder section for Expenses.
