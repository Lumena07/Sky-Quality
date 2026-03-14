# Performance Page Layout Cleanup (Tabbed Layout)

## Goal

Reorganize the Performance Dashboard so KPIs/KPTs are independent of period filters, and period-dependent content is clearly separated—using **tabs**: one tab for "KPIs & trends", one for "Period summary".

## Layout: Tabs

- **Tab 1 – "KPIs & trends"**: Content not affected by period. Fixed to current month + last 12 months.
  - KPI / KPT (targets) – 9 KPI cards grid
  - Trend charts: Overdue CAP % & Overdue CAT % & Repeat findings %; Regulatory violations (count)
  - Optional subtitle: "Current month, last 12 months"

- **Tab 2 – "Period summary"**: Content affected by the period filter.
  - **Period (summary)** dropdown at the top of this tab (Last 7 / 30 / 90 days)
  - Five metric cards: Audits completed, Findings closed, Findings opened, Overdue CAPs (now), Overdue CAT (now)
  - "By department (period)" table

## Data / fetch logic ([app/dashboard/performance/page.tsx](app/dashboard/performance/page.tsx))

- **KPI/KPT**: Use fixed `month` (current month) and `months = 12`. No user-controlled month/period for this data.
- **Summary**: Use `period` from state (7d / 30d / 90d) for summary stats and by-department; refetch when `period` changes.
- **Single API call** with `month=<currentMonth>`, `months=12`, `period=<userPeriod>`. No API changes.
- **Remove** the "Month" dropdown from the UI (KPIs always current month).

## Implementation steps

1. **Add Tabs**  
   Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` (already used in [app/documents/page.tsx](app/documents/page.tsx), [app/admin/page.tsx](app/admin/page.tsx)).

2. **Page structure**
   - Header: title "Performance Dashboard", subtitle "KPIs and trends (monthly)" — no filters.
   - `<Tabs defaultValue="kpis">` (or `value`/`onValueChange` if you need controlled state).
   - **TabsList**: two triggers — e.g. "KPIs & trends" and "Period summary".
   - **TabsContent value="kpis"**: KPI section heading + 9 KPI cards grid + the two trend chart cards.
   - **TabsContent value="summary"**: Section heading + Period (summary) `Select` + the five summary cards + By department card/table.

3. **State**
   - Keep `period` in state; remove `month` and `months` from state (derive current month and `months=12` in the fetch URL).
   - Refetch when `period` changes (same as now); KPI data in the response stays the same.

4. **Copy**
   - Tab labels: "KPIs & trends" and "Period summary".
   - In Period summary tab, under the dropdown: e.g. "Last 7 / 30 / 90 days" or reuse the selected option label.

## Files to change

- **[app/dashboard/performance/page.tsx](app/dashboard/performance/page.tsx)** only: add tabs, move Period dropdown into the second tab, fix month/months to current/12, remove Month dropdown.

## Summary

- **Layout**: Two tabs — "KPIs & trends" (top) and "Period summary" (bottom), with period filter only in the second tab.
- **Data**: One fetch; fixed month/months for KPI; `period` only affects summary and department table.
- **UI**: Use existing `@/components/ui/tabs`; no new components.
