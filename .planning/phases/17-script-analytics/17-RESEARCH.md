# Phase 17: Script Analytics - Research

**Researched:** 2026-02-16
**Domain:** Script performance analytics with niche breakdown and date range filtering
**Confidence:** HIGH

## Summary

Phase 17 adds analytics views showing which call scripts perform best overall and within specific business niches. The existing infrastructure from Phase 16 includes `get_script_outcome_stats` RPC (per-script aggregation with LEFT JOIN for zero-outcome scripts), the `script_lead_outcomes` table with proper indexes, and established patterns from the Shrike Analytics page (tabs, date range filters, shadcn chart components).

**Key architectural decisions:**
1. Analytics live on **Cold Calling leads page** (not the main Analytics tab) as a dedicated tab or collapsible section, since Cold Calling client has `client_type = 'leads_only'` which hides the Analytics tab
2. Extend existing RPC pattern with **two new functions**: `get_niche_performance_stats` (niche-level aggregation) and `get_script_niche_matrix` (script × niche cross-tabulation)
3. Date filtering uses **PostgreSQL date range WHERE clauses** with optional `p_start_date`/`p_end_date` parameters, matching the `get_revenue_by_period` RPC pattern
4. Inactive scripts **appear in analytics** (historical data preservation) but are visually distinguished

**Primary recommendation:** Build a tabbed analytics section on the Cold Calling page with three views: (1) Overall Script Performance table, (2) Performance by Niche bar chart, and (3) Script-Niche Matrix heatmap. Use simple tables over complex visualizations for MVP speed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.x | Table sorting/filtering | Industry standard for React data tables, used by Linear/Notion, integrates with shadcn Table |
| recharts | ^2.x | Bar charts | Already installed (Phase 4 revenue charts), lightweight D3-based charting |
| PostgreSQL FILTER clause | Native | Conditional aggregation | Native Postgres feature for success/fail counts, more efficient than CASE WHEN |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nivo/heatmap | ^0.87 | Heatmap visualization | Only if script-niche matrix needs visual heatmap (overkill for MVP) |
| date-fns | ^3.x | Date manipulation | Already used in codebase for date formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | ApexCharts | Better heatmap support, but 40KB+ larger bundle, not in codebase |
| @tanstack/react-table | Plain HTML tables | Simpler implementation, loses sorting/filtering/pagination |
| PostgreSQL RPCs | Client-side aggregation | Simpler backend, slower performance with 1000+ outcomes |

**Installation:**
```bash
# All required libraries already installed
# @tanstack/react-table can be added via:
# npm install @tanstack/react-table
```

## Architecture Patterns

### Recommended Component Structure
```
app/(dashboard)/leads/
├── page.tsx                     # Main leads page (add analytics section)
├── components/
│   ├── ScriptAnalytics.tsx      # New: tabbed analytics container
│   ├── OverallPerformance.tsx   # Table: per-script aggregation
│   ├── NichePerformance.tsx     # Bar chart: per-niche aggregation
│   └── ScriptNicheMatrix.tsx    # Table/heatmap: script × niche matrix
```

### Pattern 1: Component Placement (Critical Decision)

**What:** Where to place script analytics UI in the application navigation

**Analysis:**
- **Main Analytics tab:** WRONG — Cold Calling client (`client_type = 'leads_only'`) hides Analytics tab (per Phase 6 decision)
- **Dedicated Scripts tab:** Possible but adds nav complexity, splits cold calling workflow across two tabs
- **Leads page section:** RECOMMENDED — keeps all cold calling features together (leads list, script manager, analytics)

**Recommended placement:**
```tsx
// app/(dashboard)/leads/page.tsx
<div>
  {/* Existing leads list */}
  <LeadsTable />

  {/* Existing script manager */}
  <ScriptManager clientId={clientId} />

  {/* NEW: Analytics section (collapsible or always visible) */}
  {clientType === 'leads_only' && (
    <ScriptAnalytics clientId={clientId} />
  )}
</div>
```

**Alternative: Tabs on Leads page** (like ShrikeAnalytics pattern):
```tsx
<Tabs defaultValue="leads">
  <TabsList>
    <TabsTrigger value="leads">Leads</TabsTrigger>
    <TabsTrigger value="scripts">Scripts</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="leads"><LeadsTable /></TabsContent>
  <TabsContent value="scripts"><ScriptManager /></TabsContent>
  <TabsContent value="analytics"><ScriptAnalytics /></TabsContent>
</Tabs>
```

**When to use:** Tabs pattern if analytics becomes complex (5+ sections), otherwise simple collapsible section is faster to implement.

### Pattern 2: RPC Function Signatures

**What:** Three RPC functions needed for complete analytics coverage

**1. Overall Script Performance (already exists):**
```sql
-- Source: crm-dashboard/supabase/migrations/08_script_outcome_stats.sql
CREATE OR REPLACE FUNCTION get_script_outcome_stats(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,            -- ADD: join to scripts.title
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS script_id,
    s.title AS script_title,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM scripts s
  LEFT JOIN script_lead_outcomes o ON o.script_id = s.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE s.client_id = p_client_id
    -- CHANGE: Remove is_active filter to show historical data
  GROUP BY s.id, s.title
  ORDER BY total_count DESC, win_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key changes from Phase 16 RPC:**
- Add `p_start_date` and `p_end_date` parameters (optional, default NULL = all time)
- Include `script_title` in SELECT (avoid client-side join)
- Remove `is_active = true` filter (show inactive scripts with historical data, visually distinguish in UI)
- Date filter in LEFT JOIN ON clause (not WHERE) to preserve zero-outcome scripts

**2. Performance by Niche (NEW):**
```sql
CREATE OR REPLACE FUNCTION get_niche_performance_stats(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  niche_id UUID,
  niche_name TEXT,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS niche_id,
    n.name AS niche_name,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM niches n
  LEFT JOIN leads l ON l.niche_id = n.id
  LEFT JOIN script_lead_outcomes o ON o.lead_id = l.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE EXISTS (
    SELECT 1 FROM leads WHERE niche_id = n.id AND client_id = p_client_id
  )
  GROUP BY n.id, n.name
  ORDER BY total_count DESC, win_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key design:**
- Niches table is global (no client_id), filter via leads.client_id in EXISTS clause
- LEFT JOIN pattern preserves niches with zero outcomes (like scripts)
- Returns only niches used by client's leads (not all global niches)

**3. Script-Niche Matrix (NEW):**
```sql
CREATE OR REPLACE FUNCTION get_script_niche_matrix(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  niche_id UUID,
  niche_name TEXT,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS script_id,
    s.title AS script_title,
    n.id AS niche_id,
    n.name AS niche_name,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM scripts s
  CROSS JOIN niches n
  LEFT JOIN leads l ON l.niche_id = n.id AND l.client_id = p_client_id
  LEFT JOIN script_lead_outcomes o ON o.script_id = s.id AND o.lead_id = l.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE s.client_id = p_client_id
  GROUP BY s.id, s.title, n.id, n.name
  HAVING COUNT(l.id) > 0  -- Only show script-niche pairs where client has leads in that niche
  ORDER BY s.title, n.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key design:**
- CROSS JOIN creates all script × niche combinations, LEFT JOIN outcomes
- HAVING clause filters to only show niches the client uses (avoids 100+ empty rows)
- Returns flat table (UI pivots for heatmap display if needed)

### Pattern 3: Date Range Filtering UI

**What:** Consistent date range picker across all three analytics views

**Example (from analytics/page.tsx pattern):**
```tsx
type DateRange = '7d' | '30d' | '90d' | 'all'

const [dateRange, setDateRange] = useState<DateRange>('30d')

const dateRangeToFilter = (range: DateRange) => {
  const now = new Date()
  switch (range) {
    case '7d':
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now }
    case '30d':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now }
    case '90d':
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
    case 'all':
      return { start: null, end: null }
  }
}

// In RPC call
const { start, end } = dateRangeToFilter(dateRange)
const { data } = await supabase.rpc('get_script_outcome_stats', {
  p_client_id: clientId,
  p_start_date: start?.toISOString(),
  p_end_date: end?.toISOString()
})
```

**Default:** 30 days (not all-time) — recent performance is more actionable than historical (Pitfall 11 prevention)

### Pattern 4: Zero-Data Graceful Handling

**What:** Display patterns when scripts/niches have no outcome data

**Script with zero outcomes:**
```tsx
{script.stats.total_count === 0 ? (
  <span className="text-gray-400 text-sm italic">No data yet</span>
) : (
  <span className="text-gray-900 font-semibold">{script.stats.win_rate}%</span>
)}
```

**Inactive script visual distinction:**
```tsx
<tr className={script.is_active ? '' : 'opacity-50 bg-gray-50'}>
  <td>{script.title} {!script.is_active && <span className="text-xs text-gray-500">(Inactive)</span>}</td>
  <td>{script.stats.total_count}</td>
</tr>
```

**Empty state (no scripts at all):**
```tsx
{scripts.length === 0 ? (
  <div className="text-center py-8 text-gray-500">
    <p>No scripts yet. Create your first script to start tracking performance.</p>
  </div>
) : (
  <table>...</table>
)}
```

### Anti-Patterns to Avoid

**❌ Client-side aggregation:**
```tsx
// BAD: Fetch all outcomes and aggregate in React
const outcomes = await supabase.from('script_lead_outcomes').select('*')
const stats = outcomes.reduce((acc, o) => { ... })
```
**✓ Use RPC:** Server-side aggregation is 10-100x faster at scale

**❌ NaN in win rate:**
```sql
-- BAD: Division by zero returns NaN
(success_count / total_count) * 100
```
**✓ CASE guard:** `CASE WHEN total_count > 0 THEN ... ELSE 0 END`

**❌ Date filter in WHERE clause with LEFT JOIN:**
```sql
-- BAD: Filters out scripts with zero outcomes in date range
LEFT JOIN outcomes o ON o.script_id = s.id
WHERE o.created_at >= p_start_date
```
**✓ Filter in JOIN:** `LEFT JOIN outcomes o ON ... AND o.created_at >= p_start_date`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting/filtering | Custom sort state management | @tanstack/react-table | Handles edge cases (stable sort, case-insensitive filter, pagination state), used by Linear/Notion |
| Date range picker | Custom calendar UI | date-fns + native inputs or shadcn Calendar | Date math has edge cases (timezones, DST, leap years) |
| Heatmap visualization | Custom SVG grid | @nivo/heatmap or simple HTML table with background colors | Color scale normalization, tooltips, accessibility |
| RPC result caching | Custom cache implementation | React Query or SWR | Handles stale-while-revalidate, deduplication, race conditions |

**Key insight:** Analytics queries aggregate large datasets (100s-1000s of rows). Server-side aggregation via RPC is **required** for performance, not optional. Client-side filtering/sorting is fine for <100 rows.

## Common Pitfalls

### Pitfall 1: Inactive Scripts Missing from Analytics

**What goes wrong:** User creates "Summer 2025 Script", marks inactive after season ends. Analytics shows zero data for summer period because query filters `is_active = true`.

**Why it happens:** Phase 16 RPC filters `WHERE s.is_active = true` to show only active scripts in ScriptManager. Reusing same logic for analytics hides historical data.

**How to avoid:**
- Remove `is_active` filter from analytics RPCs
- Visually distinguish inactive scripts in UI (opacity 50%, "(Inactive)" label)
- Separate "active scripts" (operational view) from "all scripts" (analytical view)

**Warning signs:**
- Analytics totals don't match manual count of outcomes table
- Historical periods show zero data after scripts marked inactive
- User asks "where did my script data go?"

### Pitfall 2: Date Filter Removes Zero-Outcome Scripts

**What goes wrong:** User filters analytics to "Last 7 days". Newly created scripts (0 outcomes) disappear from the table. User thinks script creation failed.

**Why it happens:** Date filter in WHERE clause instead of LEFT JOIN ON clause:
```sql
-- BAD
LEFT JOIN outcomes o ON o.script_id = s.id
WHERE o.created_at >= p_start_date  -- NULL created_at fails this check
```

**How to avoid:**
```sql
-- GOOD
LEFT JOIN outcomes o ON o.script_id = s.id
  AND (p_start_date IS NULL OR o.created_at >= p_start_date)
-- No WHERE clause on outcome dates
```

**Warning signs:**
- Script count changes when date filter applied
- New scripts visible in "All time" but not "Last 7 days"
- EXPLAIN ANALYZE shows sequential scan instead of index

### Pitfall 3: Niche Filter Performance Degrades

**What goes wrong:** User has 50 niches. Script-niche matrix query returns 500 rows (10 scripts × 50 niches). 90% have zero outcomes. Table is mostly "No data yet".

**Why it happens:** CROSS JOIN creates every combination, HAVING filter too permissive.

**How to avoid:**
- Add `HAVING COUNT(o.id) > 0` to matrix query (only show combos with data)
- OR: Client-side filter to hide zero rows by default, with toggle to "Show all"
- Consider lazy loading: fetch top 10 niches, "Load more" button

**Warning signs:**
- Matrix table has 100+ rows, most are zeros
- Query returns in <200ms but UI feels slow (rendering 500+ table cells)
- User scrolls past dozens of empty rows to find data

### Pitfall 4: Script-Niche Matrix is Unreadable Table

**What goes wrong:** Matrix query returns flat table:
```
script_id | script_title | niche_id | niche_name | win_rate
-------------------------------------------------------------
uuid-a    | Script A     | uuid-1   | Restaurant | 67%
uuid-a    | Script A     | uuid-2   | Retail     | 45%
uuid-b    | Script B     | uuid-1   | Restaurant | 82%
```

User expects pivot table:
```
            | Restaurant | Retail | Law
Script A    | 67%        | 45%    | N/A
Script B    | 82%        | 51%    | 73%
```

**Why it happens:** PostgreSQL doesn't natively support pivot tables (crosstab extension exists but complex). Flat table is easier to query but hard to read.

**How to avoid:**

**Option 1: Client-side pivot (simple):**
```tsx
const pivotData = useMemo(() => {
  const scripts = [...new Set(data.map(d => d.script_title))]
  const niches = [...new Set(data.map(d => d.niche_name))]

  return scripts.map(script => ({
    script,
    ...Object.fromEntries(
      niches.map(niche => {
        const cell = data.find(d => d.script_title === script && d.niche_name === niche)
        return [niche, cell?.win_rate ?? null]
      })
    )
  }))
}, [data])
```

**Option 2: Keep flat table with grouping:**
```tsx
<table>
  {data.map(row => (
    <tr>
      <td>{row.script_title}</td>
      <td>{row.niche_name}</td>
      <td>{row.win_rate}%</td>
    </tr>
  ))}
</table>
```

**Option 3: Heatmap visualization (@nivo/heatmap):**
Complex to implement, deferred to post-MVP.

**Recommendation:** Start with flat table grouped by script (easiest), add pivot if user feedback demands it.

**Warning signs:**
- User squints at table trying to compare scripts across niches
- "Can you make this a grid?" feature request
- User exports to Excel to pivot manually

### Pitfall 5: All-Time Default Hides Recent Changes

**What goes wrong:** User improves "Script A" in January. Opens analytics in February, sees all-time win rate (61%). Doesn't realize January win rate is 78% (script is improving).

**Why it happens:** Default date range is "All time" instead of "Last 30 days" (Pitfall 11 from PITFALLS.md).

**How to avoid:**
- Default to `dateRange = '30d'`
- Show date range prominently in UI: "Showing last 30 days"
- Provide quick filters: 7d / 30d / 90d / All

**Warning signs:**
- User asks "has this script improved?" when data clearly shows trend
- Analytics never change (same numbers every week)
- No date range indicator in UI

## Code Examples

Verified patterns from official sources:

### Overall Script Performance Table

```tsx
// Source: Official shadcn/ui data-table pattern
// https://ui.shadcn.com/docs/components/radix/data-table

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ScriptPerformance {
  script_id: string
  script_title: string
  success_count: number
  fail_count: number
  total_count: number
  win_rate: number
  is_active?: boolean
}

export function OverallPerformance({ clientId, dateRange }: Props) {
  const [stats, setStats] = useState<ScriptPerformance[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      const { start, end } = dateRangeToFilter(dateRange)
      const { data } = await supabase.rpc('get_script_outcome_stats', {
        p_client_id: clientId,
        p_start_date: start?.toISOString(),
        p_end_date: end?.toISOString()
      })
      setStats(data || [])
    }
    fetchStats()
  }, [clientId, dateRange])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Script</TableHead>
          <TableHead className="text-right">Total Calls</TableHead>
          <TableHead className="text-right">Success</TableHead>
          <TableHead className="text-right">Fail</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stats.map((script) => (
          <TableRow
            key={script.script_id}
            className={!script.is_active ? 'opacity-50 bg-gray-50' : ''}
          >
            <TableCell>
              {script.script_title}
              {!script.is_active && (
                <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
              )}
            </TableCell>
            <TableCell className="text-right">{script.total_count}</TableCell>
            <TableCell className="text-right text-green-600">{script.success_count}</TableCell>
            <TableCell className="text-right text-red-600">{script.fail_count}</TableCell>
            <TableCell className="text-right font-semibold">
              {script.total_count === 0 ? (
                <span className="text-gray-400 text-sm italic">No data yet</span>
              ) : (
                `${script.win_rate}%`
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Date Range Filter Component

```tsx
// Source: Pattern from crm-dashboard/app/(dashboard)/analytics/page.tsx
// Uses button group pattern from ShrikeAnalytics.tsx

type DateRange = '7d' | '30d' | '90d' | 'all'

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const options: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ]

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

### Niche Performance Bar Chart

```tsx
// Source: recharts BarChart pattern
// https://recharts.org/en-US/api/BarChart

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface NicheStats {
  niche_name: string
  total_count: number
  win_rate: number
}

export function NichePerformance({ data }: { data: NicheStats[] }) {
  // Filter out niches with zero outcomes
  const dataWithOutcomes = data.filter(d => d.total_count > 0)

  if (dataWithOutcomes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No niche data yet. Assign niches to leads to see performance breakdown.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dataWithOutcomes}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="niche_name" />
        <YAxis label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Bar dataKey="win_rate" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side aggregation | PostgreSQL RPCs with FILTER clause | 2020+ | 10-100x performance improvement for analytics |
| All-time default | 30-day default with range selector | 2024+ UX research | Focuses on actionable recent data |
| Recharts only | Recharts + @tanstack/react-table | 2024+ | Better table UX (sorting, filtering) without chart library bloat |
| Custom components | shadcn/ui primitives | 2023+ | Code ownership, smaller bundle, Tailwind consistency |

**Deprecated/outdated:**
- **React Table v7:** Superseded by @tanstack/react-table v8 (TanStack rebrand, TypeScript rewrite)
- **Recharts heatmaps via community packages:** Native recharts doesn't support heatmaps well, use @nivo/heatmap or HTML tables

## Open Questions

Things that couldn't be fully resolved:

1. **Should inactive scripts appear by default in analytics?**
   - What we know: Phase 16 RPC filters `is_active = true`, historical data exists for inactive scripts
   - What's unclear: User expectation — do they want to see retired scripts in recent analytics?
   - Recommendation: Show all scripts (active + inactive) in analytics, visually distinguish inactive. Add toggle filter "Active only" if users request it.

2. **Is script-niche matrix MVP or post-MVP?**
   - What we know: Matrix query is complex, UI is harder to read (pivot table or flat table trade-offs)
   - What's unclear: User value — do they actively compare "which script works best for Restaurant niche" or just overall performance?
   - Recommendation: Defer matrix to post-MVP. Ship overall + niche views first, gather feedback, add matrix if requested.

3. **Should date range persist across page reloads?**
   - What we know: ShrikeAnalytics doesn't persist date filter state (resets to default on reload)
   - What's unclear: User workflow — do they set "Last 7 days" and expect it to persist next session?
   - Recommendation: Start without persistence (simpler), add localStorage persistence if users request it (1 line: `localStorage.setItem('scriptAnalyticsDateRange', dateRange)`).

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Documentation: Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html) — FILTER clause, COUNT behavior with LEFT JOIN
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/radix/data-table) — Table component with @tanstack/react-table integration
- [Recharts Official Documentation](https://recharts.org/) — BarChart API, ResponsiveContainer usage
- [Supabase RPC Reference](https://supabase.com/docs/reference/javascript/v1/rpc) — RPC call patterns, date parameter handling
- Codebase: `crm-dashboard/supabase/migrations/08_script_outcome_stats.sql` — Existing RPC pattern with LEFT JOIN
- Codebase: `crm-dashboard/app/(dashboard)/analytics/page.tsx` — Date range filter UI pattern
- Codebase: `crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx` — Tab pattern, button group styling

### Secondary (MEDIUM confidence)
- [How to Select Dates Between Two Dates in PostgreSQL - GeeksforGeeks](https://www.geeksforgeeks.org/postgresql/how-to-select-dates-between-two-dates-in-postgresql/) — Date range filtering approaches (BETWEEN vs comparisons)
- [PostgreSQL DateRange and Efficient Time Management - Hashrocket](https://hashrocket.com/blog/posts/postgresql-daterange-and-efficient-time-management) — Range types for date filtering
- [Indexing SQL range conditions - Use The Index, Luke](https://use-the-index-luke.com/sql/where-clause/searching-for-ranges/greater-less-between-tuning-sql-access-filter-predicates) — Index usage with date ranges
- [How I Fixed My App's Slow Queries Using Supabase RPC Functions - Medium](https://medium.com/@jigsz6391/how-i-fixed-my-apps-slow-queries-in-minutes-using-supabase-rpc-functions-243173b41084) — Performance benefits of RPC aggregation
- [Debugging performance issues - Supabase Docs](https://supabase.com/docs/guides/database/debugging-performance) — EXPLAIN ANALYZE for query optimization
- [Best Practices for Implementing Embedded Analytics](https://sranalytics.io/blog/implementing-embedded-analytics/) — Analytics placement UX (context-switching problem)
- [What Is Embedded Analytics? - Yellowfin](https://www.yellowfinbi.com/blog/what-is-embedded-analytics) — Gartner 2026 prediction (80% prefer embedded over dashboards)

### Tertiary (LOW confidence)
- [React Heatmap Charts - ApexCharts](https://apexcharts.com/react-chart-demos/heatmap-charts/) — Heatmap visualization alternative (not recharts)
- [Support for heat map? - recharts GitHub issue #237](https://github.com/recharts/recharts/issues/237) — Recharts heatmap limitations (2016 issue, community workarounds)
- [Advanced Shadcn Table with Server-Side Sort/Filter](https://next.jqueryscript.net/shadcn-ui/advanced-shadcn-table/) — TanStack Table advanced patterns (sort/filter/paginate)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in codebase or standard for React analytics
- Architecture: HIGH — Patterns verified from existing analytics page, RPC migration, shadcn usage
- Pitfalls: HIGH — Directly sourced from Phase 16 lessons (LEFT JOIN, NaN guards) and PITFALLS.md domain research

**Research date:** 2026-02-16
**Valid until:** ~60 days (stable domain, analytics patterns don't change rapidly)
