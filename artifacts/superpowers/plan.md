# Plan: Financial Dashboard Implementation

## Goal
Implement a centralized **Financial Dashboard** in the frontend that visualizes Real Incomes (from Calendar Events) and provides a placeholder UI for Expenses.

## Assumptions
-   `Event` model has `amountPaid`, `summary`, and `eventType` fields populated enough to use regex/filtering.
-   `ZenStack` hooks (`useFindManyEvent`) are available and performant enough for checking a month's worth of events.
-   No new backend models needed (Expenses are UI-only for now).
-   **Permissions**: The Dashboard is accessible to **ALL** authenticated users (no RBAC), similar to `/account` page.

## Plan

### Step 1: Create Dashboard Hook & Types
Create the logic to fetch and transform Calendar Events into Financial Income objects.
-   **Files**:
    -   `apps/web/src/features/finance/hooks/useFinancialSummary.ts` (NEW)
    -   `apps/web/src/features/finance/types.ts`
-   **Change**:
    -   Define `IncomeGroup` interface (category, total, items).
    -   Implement `useFinancialSummary(dateRange)` hook using `useFindManyEvent`.
    -   Add logic to filter/map events:
        -   "Tratamientos": Events with `eventType` or `summary` matching "Subcutáneo".
        -   "Exámenes": Events matching "Spirometry", "Test", etc.
-   **Verify**: `pnpm type-check`

### Step 2: Implement Financial Dashboard UI Components
Create the visual components for the dashboard.
-   **Files**:
    -   `apps/web/src/features/finance/components/FinancialSummaryCards.tsx` (NEW)
    -   `apps/web/src/features/finance/components/IncomeBreakdown.tsx` (NEW)
    -   `apps/web/src/features/finance/components/ExpensePlaceholder.tsx` (NEW)
-   **Change**:
    -   `FinancialSummaryCards`: Show Total Income, Total Expense (0), Net.
    -   `IncomeBreakdown`: Accordion/Table grouped by Category -> Subcategory.
    -   `ExpensePlaceholder`: "Coming Soon" or empty list UI.
-   **Verify**: `pnpm lint` and visual check (implied).

### Step 3: Create Dashboard Page & Route
Connect the components to the router without RBAC checks.
-   **Files**:
    -   `apps/web/src/features/finance/pages/FinancialDashboardPage.tsx` (NEW)
    -   `apps/web/src/routes/_authed/finanzas/dashboard.tsx` (NEW)
-   **Change**:
    -   `FinancialDashboardPage`: Assemble `DateRangePicker`, `FinancialSummaryCards`, `IncomeBreakdown`, `ExpensePlaceholder`.
    -   Create route `/finanzas/dashboard` **WITHOUT** `staticData.permission` or `beforeLoad` role checks. (Allow access to any authenticated user, same pattern as `_authed/account.tsx`).
-   **Verify**: `pnpm dev`, navigate to `/finanzas/dashboard` as a basic user.

### Step 4: Verify & Polish
Ensure data accuracy with real events.
-   **Files**: `apps/web/src/features/finance/hooks/useFinancialSummary.ts`
-   **Change**: Refine regex/filtering logic based on real data observation.
-   **Verify**: Check numbers against Calendar.

## Risks & mitigations
-   **Risk**: Event data might be messier than expected (inconsistent strings).
    -   *Mitigation*: Add "Uncategorized" bucket in `IncomeBreakdown` to catch unmatched paid events.
-   **Risk**: Performance loop if fetching too many events.
    -   *Mitigation*: Strict date range filtering in `useFindManyEvent`.

## Rollback plan
-   Delete `apps/web/src/routes/_authed/finanzas/dashboard.tsx`.
-   Delete created components/hooks in `features/finance`.
