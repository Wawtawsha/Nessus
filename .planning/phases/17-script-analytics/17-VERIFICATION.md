---
phase: 17-script-analytics
verified: 2026-02-16T16:05:00Z
status: gaps_found
score: 6/7 must-haves verified
gaps:
  - truth: "Inactive scripts appear in analytics with visual distinction (dimmed, '(Inactive)' label)"
    status: partial
    reason: "ScriptNicheMatrix does NOT show inactive scripts with visual distinction - get_script_niche_matrix RPC doesn't return is_active column"
    artifacts:
      - path: "crm-dashboard/supabase/migrations/09_script_analytics_rpcs.sql"
        issue: "get_script_niche_matrix RETURNS TABLE does not include is_active BOOLEAN column"
      - path: "crm-dashboard/types/script.ts"
        issue: "ScriptNicheCell interface does not include is_active field"
      - path: "crm-dashboard/components/ScriptNicheMatrix.tsx"
        issue: "Component has comment acknowledging missing field: '/* Inactive marker would go here if we had is_active in response */'"
    missing:
      - "Add is_active BOOLEAN to get_script_niche_matrix RETURNS TABLE (line 217)"
      - "Add s.is_active to SELECT clause in get_script_niche_matrix (around line 231)"
      - "Add s.is_active to GROUP BY clause in get_script_niche_matrix (line 252)"
      - "Add is_active: boolean to ScriptNicheCell interface in types/script.ts"
      - "Add opacity-50 className and '(Inactive)' label to ScriptNicheMatrix.tsx rows when !row.is_active (line 103-106)"
---

# Phase 17: Script Analytics Verification Report

**Phase Goal:** Users can see which scripts perform best overall and within specific business niches

**Verified:** 2026-02-16T16:05:00Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees analytics section on Cold Calling leads page with date range filter | VERIFIED | ScriptAnalytics imported in leads/page.tsx (line 11), rendered in collapsible section (line 316), date range filter with 7d/30d/90d/all buttons (ScriptAnalytics.tsx lines 25-44) |
| 2 | User sees overall script performance table showing total calls, success, fail, and win rate per script | VERIFIED | OverallPerformance.tsx renders Table with 5 columns (lines 78-83), calls get_script_outcome_stats RPC (line 44), displays stats.total_count, success_count, fail_count, win_rate (lines 94-106) |
| 3 | User sees niche performance bar chart showing win rates by niche | VERIFIED | NichePerformance.tsx renders recharts BarChart (lines 79-103), calls get_niche_performance_stats RPC (line 45), Bar dataKey="win_rate" (line 101) |
| 4 | User sees script-niche matrix table showing which scripts work best for which niches | VERIFIED | ScriptNicheMatrix.tsx renders Table with script/niche/stats columns (lines 84-91), calls get_script_niche_matrix RPC (line 44), visual grouping via border-t-2 when script changes (line 101) |
| 5 | Scripts with zero outcomes show 'No data yet' instead of NaN or errors | VERIFIED | OverallPerformance checks total_count === 0 (line 102), ScriptNicheMatrix checks total_count === 0 (line 116), both render "No data yet" in gray italic (lines 103, 117) |
| 6 | Inactive scripts appear in analytics with visual distinction (dimmed, '(Inactive)' label) | PARTIAL | OverallPerformance: VERIFIED - opacity-50 className (line 87), "(Inactive)" label (line 91). ScriptNicheMatrix: FAILED - has comment "Inactive marker would go here if we had is_active in response" (line 105), get_script_niche_matrix RPC does NOT return is_active column |
| 7 | Date range filter defaults to 30 days and updates all three views when changed | VERIFIED | ScriptAnalytics useState defaults to '30d' (line 16), dateRange passed as prop to all three sub-components (lines 71, 74, 77), each component has useEffect with dateRange dependency (OverallPerformance line 59, NichePerformance line 64, ScriptNicheMatrix line 63) |

**Score:** 6/7 truths verified (1 partial failure)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| crm-dashboard/supabase/migrations/09_script_analytics_rpcs.sql | Three RPC functions with date filtering | SUBSTANTIVE | EXISTS (264 lines), DROP old function (line 28), 3 CREATE OR REPLACE FUNCTIONs, all with SECURITY DEFINER, date filter in LEFT JOIN ON clause, COUNT(o.id) pattern |
| crm-dashboard/types/script.ts | Analytics TypeScript interfaces | SUBSTANTIVE | EXISTS (65 lines), ScriptPerformance (lines 34-42), NichePerformance (lines 44-51), ScriptNicheCell (lines 53-62), DateRange type (line 64) |
| crm-dashboard/components/ScriptAnalytics.tsx | Tabbed container with date range | SUBSTANTIVE | EXISTS (82 lines), imports all 3 sub-components (lines 5-7), date range state defaults '30d' (line 16), view selector (lines 48-66), passes clientId + dateRange to sub-components |
| crm-dashboard/components/OverallPerformance.tsx | Per-script table | SUBSTANTIVE | EXISTS (114 lines), calls get_script_outcome_stats RPC (line 44), Table with 5 columns, inactive script handling (lines 87-92), zero-outcome "No data yet" (lines 102-105) |
| crm-dashboard/components/NichePerformance.tsx | Per-niche bar chart | SUBSTANTIVE | EXISTS (105 lines), calls get_niche_performance_stats RPC (line 45), recharts BarChart with win_rate on Y-axis, custom Tooltip (lines 84-100), filters zero total_count (line 56) |
| crm-dashboard/components/ScriptNicheMatrix.tsx | Script x niche table | PARTIAL | EXISTS (129 lines), calls get_script_niche_matrix RPC (line 44), Table with 6 columns, visual grouping border-t-2 (line 101), zero-outcome handling (lines 116-120). ISSUE: Comment acknowledges missing is_active field (line 105) |
| crm-dashboard/components/ui/table.tsx | shadcn Table primitive | VERIFIED | EXISTS, exports Table/TableHeader/TableBody/TableRow/TableHead/TableCell |
| crm-dashboard/app/(dashboard)/leads/page.tsx | Leads page with ScriptAnalytics | WIRED | MODIFIED, imports ScriptAnalytics (line 11), analyticsExpanded state defaults false (line 48), collapsible section renders ScriptAnalytics with currentClientId (lines 303-320) |


### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| ScriptAnalytics.tsx | OverallPerformance, NichePerformance, ScriptNicheMatrix | Props: clientId + dateRange | WIRED | All three components imported (lines 5-7), rendered conditionally by activeView (lines 70-78) |
| OverallPerformance.tsx | get_script_outcome_stats RPC | supabase.rpc call in useEffect | WIRED | Line 44: supabase.rpc with p_client_id, p_start_date, p_end_date parameters |
| NichePerformance.tsx | get_niche_performance_stats RPC | supabase.rpc call in useEffect | WIRED | Line 45: supabase.rpc with date parameters, filters zero total_count client-side (line 56) |
| ScriptNicheMatrix.tsx | get_script_niche_matrix RPC | supabase.rpc call in useEffect | WIRED | Line 44: supabase.rpc with date parameters, filters zero total_count client-side (line 55) |
| leads/page.tsx | ScriptAnalytics.tsx | Import and render | WIRED | Import line 11, renders in collapsible section (lines 303-320), passes clientId prop |
| 09_script_analytics_rpcs.sql | scripts/niches tables | LEFT JOIN with date filter | WIRED | Date filter in ON clause (not WHERE), preserves zero-outcome entities |

### Requirements Coverage

No REQUIREMENTS.md file found. Phase 17 in ROADMAP.md references SCRIPT-04 but requirements file does not exist.

**Based on ROADMAP Success Criteria:**

| Success Criterion | Status | Evidence |
|-------------------|--------|----------|
| 1. Cold Calling analytics view shows overall script performance table | SATISFIED | OverallPerformance.tsx renders table with all required columns |
| 2. Analytics view shows performance breakdown by niche | SATISFIED | NichePerformance.tsx renders bar chart with win rates by niche |
| 3. Analytics view shows script-within-niche matrix | SATISFIED | ScriptNicheMatrix.tsx renders grouped table with script x niche breakdown |
| 4. Scripts with zero outcomes display gracefully | SATISFIED | Both OverallPerformance and ScriptNicheMatrix show "No data yet" for zero outcomes |
| 5. Date range filter allows comparison | SATISFIED | ScriptAnalytics has 7d/30d/90d/all filter, defaults to 30d, updates all views |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ScriptNicheMatrix.tsx | 105 | Comment: "Inactive marker would go here if we had is_active in response" | Warning | Indicates incomplete implementation |
| ScriptNicheMatrix.tsx | 54-56 | Client-side filter for total_count > 0 | Info | Defensive but redundant with SQL HAVING |
| NichePerformance.tsx | 55-57 | Client-side filter for total_count > 0 | Info | Defensive filtering, not harmful |

### Human Verification Required

#### 1. Visual Analytics Layout

**Test:** Open Cold Calling leads page, expand Script Analytics section, switch between views, change date ranges

**Expected:** Analytics section expands smoothly, buttons highlight correctly, tables and chart render cleanly without overflow

**Why human:** Layout, animation smoothness, chart proportions cannot be verified programmatically

#### 2. Empty State Messages

**Test:** View analytics for clients with (a) no scripts, (b) scripts with no outcomes, (c) niches with no outcomes

**Expected:** Appropriate contextual messages display for each empty state

**Why human:** Need to create specific test data states

#### 3. Inactive Script Visual Distinction

**Test:** Create a script, mark it inactive, record outcomes, check Overall Performance table

**Expected:** Inactive script row has opacity-50 and shows "(Inactive)" label in gray

**Why human:** Need to create test data with inactive script

#### 4. Date Range Filtering Accuracy

**Test:** Record outcomes on specific dates (5 days ago, 35 days ago, 95 days ago), switch date filters

**Expected:** Filters show correct outcomes based on date range selection

**Why human:** Need controlled test data with specific timestamps

#### 5. Script-Niche Matrix Grouping

**Test:** Create 2 scripts and 3 niches, record outcomes for various combinations

**Expected:** Scripts grouped visually, sorted by script title then niche name

**Why human:** Visual grouping verification requires human inspection

### Gaps Summary

**1 gap blocking full goal achievement:**

**Gap: ScriptNicheMatrix does not show inactive scripts with visual distinction**

**Why it matters:** The phase goal requires "Inactive scripts appear in analytics with visual distinction" for all views. OverallPerformance satisfies this, but ScriptNicheMatrix does not.

**What is missing:**
1. Database layer: get_script_niche_matrix RPC does not return is_active column
2. Type layer: ScriptNicheCell interface does not include is_active field
3. UI layer: ScriptNicheMatrix.tsx has comment acknowledging missing field but does not render inactive distinction

**Impact:** Users viewing the "By Script + Niche" matrix cannot tell which scripts are inactive. This creates inconsistency with the Overall Performance view and may lead to confusion.

**Severity:** Medium - does not break functionality, but creates UX inconsistency and violates stated success criteria.

---

*Verified: 2026-02-16T16:05:00Z*
*Verifier: Claude (gsd-verifier)*
