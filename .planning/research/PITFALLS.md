# Domain Pitfalls: Cold Calling Scripts (v1.4)

**Domain:** Adding call script management, outcome tracking, user-defined niche taxonomy, and derived analytics to an existing CRM
**Researched:** 2026-02-15
**Overall confidence:** HIGH (grounded in verified domain research + Supabase/Next.js constraints)

---

## Critical Pitfalls

Mistakes that cause data corruption, security vulnerabilities, or fundamentally broken features.

---

### Pitfall 1: Orphaned Outcomes When Scripts or Leads are Deleted

**What goes wrong:** The PROJECT.md states "every outcome must link to a specific lead (no standalone counters)" and "script counters are aggregated from script_lead_outcomes, not independent values." When a user deletes a call script that has 50 recorded outcomes, what happens to those outcomes? When a lead is deleted that has 12 call outcomes across 4 different scripts, what happens?

Without proper foreign key configuration, three catastrophic scenarios occur:

1. **CASCADE DELETE (wrong choice):** Deleting a script wipes out all historical outcome data. Your "Script A had 73% success rate" analytics disappear overnight. Regulatory compliance fails — you cannot reconstruct which leads were contacted when if the audit trail is gone.

2. **RESTRICT (blocks deletion):** User tries to delete an old script, gets a cryptic error: "Cannot delete script — foreign key constraint violation." This is technically correct but terrible UX. Now they cannot clean up old scripts without manually deleting hundreds of outcomes first, or they abandon cleanup entirely and live with 50 outdated scripts cluttering the UI.

3. **NO CONSTRAINT (data corruption):** Outcomes reference `script_id = uuid_of_deleted_script`. Queries break silently. The analytics page shows: "Top performing scripts: [null], [null], Script B (64%)". The app looks broken.

**Why it happens:** Foreign key cascade behavior feels like a database implementation detail to handle later. The initial table creation focuses on happy-path CRUD: "insert script, insert outcome, display list." Only during testing does someone try deleting a script with outcomes, and by then the schema is deployed.

**Consequences:**
- Analytics become unreliable or disappear entirely
- Cannot reconstruct call history for auditing
- UX degrades (cannot delete scripts, or deletes silently corrupt data)
- Violates telemarketing compliance requirements (must retain call records for 3-7 years depending on jurisdiction)

**Warning signs:**
- Migration files create tables without defining `ON DELETE` behavior
- "Delete script" feature implemented before handling outcome orphans
- No test case for "delete script with outcomes" scenario

**Prevention:**

For scripts:
- **Use SOFT DELETE pattern** — Add `deleted_at` column to scripts table. "Delete" action sets `deleted_at = NOW()`, filters exclude deleted scripts by default. Outcomes retain reference to script, analytics can reconstruct "at the time this was called 'Summer 2025 Intro Script'" even after deletion.
- Alternative: `ON DELETE SET NULL` with a `deleted_script_name` column. When script is deleted, copy the script name to `deleted_script_name` in all outcomes, then set `script_id = NULL`. Analytics can show: "Deleted script (Summer 2025 Intro): 73% success."

For leads:
- **RESTRICT deletion** — Leads with call outcomes cannot be deleted, must be archived instead. Add `is_archived` boolean. This preserves the audit trail.
- If hard deletion is truly required (GDPR right-to-erasure), `ON DELETE CASCADE` for outcomes is acceptable, BUT log the deletion event separately: "Lead X deleted on DATE, had N outcomes attached" so the analytics can note "5 outcomes excluded from historical data due to lead deletion."

**Which phase should address it:** Database schema design phase (BEFORE implementing any delete functionality). This is a table creation decision, not a feature decision.

**Severity:** CRITICAL — silent data loss or broken analytics from day one. Cannot be safely retrofitted after outcomes exist in production.

---

### Pitfall 2: RLS Policies Enabled Without Select Policies = Empty Results

**What goes wrong:** Supabase best practice is to enable Row Level Security (RLS) on all tables. You create a `call_scripts` table, enable RLS, write an INSERT policy ("users can create scripts"), write an UPDATE policy ("users can edit their own scripts"). You deploy. The UI shows zero scripts. No error messages. Just an empty list.

The problem: **UPDATE policies require a corresponding SELECT policy**. Without a SELECT policy, `supabase.from('call_scripts').select()` returns zero rows even if scripts exist. The user interface appears broken but the database is functioning exactly as designed — RLS with no SELECT policy means "no one can read this data."

This is compounded by Supabase's client-side query pattern (Next.js 14 with no server-side cron). Every query runs through the anon key with RLS enabled. Unlike server frameworks where you might catch the missing policy in a test suite, the first sign of the problem is the deployed production UI showing no data.

**Why it happens:** Policy creation is not atomic. You enable RLS immediately (to prevent accidental data exposure during development), then write policies incrementally as you build features. SELECT feels less dangerous than INSERT/UPDATE/DELETE so it gets delayed. "I'll add proper SELECT policies after I implement auth" — but the feature is already deployed.

**Consequences:**
- Scripts page shows "No scripts yet" even when scripts exist
- Lead outcomes cannot be fetched, analytics show zero data
- Users report "the app is broken" but logs show no errors (empty results are valid)
- Debugging wastes hours because the query syntax is correct, the data exists, but RLS silently blocks access

**Warning signs:**
- Migration enables RLS but only defines INSERT/UPDATE/DELETE policies
- `supabase.from('table').select()` returns `{ data: [], error: null }`
- Database query in Supabase SQL Editor returns rows, but UI shows none

**Prevention:**
- **Policy checklist:** For every table with RLS, define policies in this order: SELECT (first), INSERT, UPDATE, DELETE
- **Start permissive, tighten later:** Initial SELECT policy can be `(true)` (allow all reads). Once the feature works, add proper user filtering: `auth.uid() = user_id`
- **Test with RLS-enabled client:** Don't develop against service_role key (which bypasses RLS). Use anon key from the start so missing policies surface immediately
- **Supabase Dashboard Advisor:** The database advisors panel shows tables with RLS enabled but no policies (lint code 0013_rls_disabled_in_public). Check this before deploying.

**Example safe policy pattern:**
```sql
-- call_scripts table
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;

-- Allow all users to SELECT their scripts (or all scripts if single-user tool)
CREATE POLICY "Anyone can view scripts" ON call_scripts
  FOR SELECT USING (true);

-- Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can create scripts" ON call_scripts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to UPDATE/DELETE their own scripts (if multi-user)
-- For single-user admin tool, can use (true) for these as well
CREATE POLICY "Users can edit their scripts" ON call_scripts
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their scripts" ON call_scripts
  FOR DELETE USING (true);
```

**Which phase should address it:** Database schema phase. RLS policies must exist before the first feature implementation touches the table.

**Severity:** CRITICAL — feature appears completely broken with no error messages. Wastes implementation time debugging phantom issues.

---

### Pitfall 3: User-Defined Taxonomy Creates Duplicate Entries and Inconsistent Casing

**What goes wrong:** Niche taxonomy is user-defined with a combo selector: pick existing or create new. User types "Real Estate" and creates it. Later, user types "real estate" (lowercase) — the system sees this as a new niche because string comparison is case-sensitive. Now the analytics show:
- Real Estate: 12 leads
- real estate: 8 leads
- REAL ESTATE: 3 leads

Worse, typos and pluralization create noise:
- "Restaurent" (misspelling)
- "Restaurant" / "Restaurants" (singular vs plural)
- "Auto Repair" / "Auto repair" / "AutoRepair" (spacing variations)

After 6 months, the niche dropdown has 40+ entries, 60% of which are duplicates or variations. The "niche analytics" feature becomes useless because data is fragmented.

**Why it happens:** Free-text input with no normalization. The combo selector allows users to type anything, and the database stores exactly what they typed. There is no deduplication logic, no case normalization, no fuzzy matching. "Just let users create niches" sounds simple, but without guardrails, it devolves into chaos.

**Consequences:**
- Niche dropdown becomes cluttered and unusable
- Analytics are fragmented: "Restaurant" appears to underperform because 60% of restaurant leads are tagged as "Restaurants" or "restaurant"
- Users spend time merging duplicates manually (if even possible)
- Data quality degrades over time proportional to usage

**Warning signs:**
- Niche creation is just `INSERT INTO niches (name) VALUES ($1)` with no normalization
- No case-insensitive uniqueness constraint on niche names
- Combo selector allows free text without auto-correction or suggestions
- Multiple entries in niche table with similar names (found via `SELECT name, COUNT(*) FROM niches GROUP BY LOWER(name) HAVING COUNT(*) > 1`)

**Prevention:**

**Schema-level enforcement:**
```sql
-- Normalize niche names: trim whitespace, convert to Title Case on insert
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on normalized name prevents duplicates
CREATE UNIQUE INDEX niches_normalized_unique ON niches(name_normalized);
```

**Application-level normalization:**
```typescript
function normalizeNicheName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Title Case
    .join(' ')
}

// Before insert, normalize and check for existing
const normalized = normalizeNicheName(userInput)
const { data: existing } = await supabase
  .from('niches')
  .select('id, name')
  .eq('name_normalized', normalized.toLowerCase())
  .single()

if (existing) {
  // Use existing niche instead of creating duplicate
  return existing
} else {
  // Create new with normalized name
  await supabase.from('niches').insert({ name: normalized })
}
```

**UX improvements:**
- Combo selector with autocomplete: as user types "rest", suggest "Restaurant" (existing)
- Show fuzzy matches: user types "Restaurent", suggest "Did you mean: Restaurant?"
- Admin cleanup tool: list similar niches side-by-side with merge button ("Restaurant" + "Restaurants" → "Restaurant")

**Which phase should address it:** Niche taxonomy creation phase. The schema constraint MUST exist before the first niche is created. The normalization logic MUST exist in the "create niche" form handler.

**Severity:** CRITICAL — data quality issue that compounds over time and cannot be fully fixed retroactively (merging niches requires reassigning all leads, which may lose historical context).

---

### Pitfall 4: Script Performance Analytics Break When No Outcomes Exist

**What goes wrong:** Analytics query structure for "top performing scripts by success rate":

```sql
SELECT
  scripts.name,
  COUNT(*) FILTER (WHERE outcomes.result = 'success') AS successes,
  COUNT(*) AS total_calls,
  (COUNT(*) FILTER (WHERE outcomes.result = 'success')::float / COUNT(*)) * 100 AS success_rate
FROM call_scripts scripts
LEFT JOIN script_lead_outcomes outcomes ON scripts.id = outcomes.script_id
GROUP BY scripts.id, scripts.name
ORDER BY success_rate DESC
```

This query has a fatal flaw: **division by zero** when a script has zero outcomes. `COUNT(*)` returns 0, `0::float / 0` returns `NaN` in PostgreSQL (or throws an error in other databases). The UI displays:

- "Script A: NaN% success rate"
- "Script B: NaN% success rate"
- "Script C: 67% success rate"

Sorting breaks (NaN sorts unpredictably), charts cannot render (NaN is not a valid number for chart libraries), and the feature looks broken.

Worse, if you filter to only include scripts with outcomes (`HAVING COUNT(*) > 0`), then newly created scripts disappear from the list entirely. Users create "Script D", navigate to analytics, don't see it, and think creation failed.

**Why it happens:** Analytics queries are written for the steady-state case (scripts with data) without considering the empty-state case (newly created scripts with zero outcomes). SQL aggregate functions have non-intuitive behavior with empty sets (COUNT returns 0, SUM returns NULL, AVG returns NULL).

**Consequences:**
- Analytics show NaN or blank values
- New scripts invisible in analytics until first outcome recorded
- Sorting/filtering breaks unpredictably
- Chart rendering libraries throw errors or display "No data"

**Warning signs:**
- Analytics query has division without NULL/zero handling
- No test case for "script with zero outcomes"
- HAVING clause filters out empty groups entirely
- Frontend code assumes success_rate is always a number (no NaN check)

**Prevention:**

**SQL-level safety:**
```sql
SELECT
  scripts.id,
  scripts.name,
  COUNT(outcomes.id) AS total_calls,
  COUNT(*) FILTER (WHERE outcomes.result = 'success') AS successes,
  CASE
    WHEN COUNT(outcomes.id) = 0 THEN NULL  -- or 0, depending on desired display
    ELSE (COUNT(*) FILTER (WHERE outcomes.result = 'success')::float / COUNT(outcomes.id)) * 100
  END AS success_rate
FROM call_scripts scripts
LEFT JOIN script_lead_outcomes outcomes ON scripts.id = outcomes.script_id
GROUP BY scripts.id, scripts.name
ORDER BY
  CASE WHEN success_rate IS NULL THEN 1 ELSE 0 END,  -- NULL values sort last
  success_rate DESC
```

**TypeScript-level safety:**
```typescript
type ScriptPerformance = {
  id: string
  name: string
  total_calls: number
  successes: number
  success_rate: number | null  // Explicitly nullable
}

// Display logic
function formatSuccessRate(rate: number | null): string {
  if (rate === null) return 'No data yet'
  return `${rate.toFixed(1)}%`
}

// Chart filtering
const scriptsWithData = scripts.filter(s => s.success_rate !== null)
```

**Which phase should address it:** Analytics implementation phase, but the data model must support it (NULL-safe aggregations).

**Severity:** CRITICAL — makes analytics unusable and creates perception that the feature is broken. Must handle from day one.

---

### Pitfall 5: Missing Indexes on Outcome Foreign Keys = Slow Queries From Day One

**What goes wrong:** The script performance analytics query joins `call_scripts` to `script_lead_outcomes` on `outcomes.script_id = scripts.id`. Without an index on `script_id`, PostgreSQL performs a sequential scan of the entire outcomes table for EVERY script. At 50 scripts and 1,000 outcomes, this query takes 200-500ms. At 100 scripts and 10,000 outcomes, it takes 3-5 seconds. The analytics page becomes unusable.

The irony: this is a **day-one problem** that feels like a scale problem. Users report "the analytics page is slow" from the very first 100 outcomes, but the developer assumes "it's only 100 rows, it should be instant" and looks elsewhere (JavaScript performance, network latency, Supabase cold starts). The real culprit is missing indexes.

**Why it happens:** Supabase auto-creates indexes for primary keys but NOT for foreign keys. When you create a table:

```sql
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY,
  script_id UUID NOT NULL REFERENCES call_scripts(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Supabase creates an index on `id` (the primary key) automatically. It does NOT create indexes on `script_id` or `lead_id`. Every JOIN or WHERE clause on those columns is a sequential scan.

The developer assumes foreign key constraints imply indexes (as they do in some databases like MySQL/InnoDB), but in PostgreSQL they do NOT.

**Consequences:**
- Analytics queries slow from the start (100+ rows)
- Supabase query timeouts at scale (default 60s timeout)
- "Top scripts" analytics takes 2-5 seconds to load
- Real-time outcome tracking (if implemented) becomes sluggish
- Compounds with RLS policy evaluation (RLS + sequential scan = very slow)

**Warning signs:**
- Analytics query takes >100ms with only 100 outcome rows
- Supabase query plan (via `EXPLAIN ANALYZE`) shows "Seq Scan" on outcomes table
- Query duration increases linearly with outcome count (sign of O(n) scan)
- Supabase Performance Advisor flags missing indexes

**Prevention:**

**Add indexes immediately after table creation:**
```sql
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES call_scripts(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  result TEXT NOT NULL CHECK (result IN ('success', 'fail')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for script performance queries (GROUP BY script_id)
CREATE INDEX idx_outcomes_script_id ON script_lead_outcomes(script_id);

-- Index for lead history queries (WHERE lead_id = ?)
CREATE INDEX idx_outcomes_lead_id ON script_lead_outcomes(lead_id);

-- Composite index for niche analytics if outcomes link to lead.niche_id via join
-- (Added later if query patterns show need)
```

**RLS-specific index (critical for Supabase):**

If RLS policies filter by `user_id` (multi-user scenario):
```sql
-- Assume outcomes have user_id column
CREATE INDEX idx_outcomes_user_script ON script_lead_outcomes(user_id, script_id);
```

This supports the pattern: "show me success rate for MY scripts with MY outcomes."

**Testing:**
```sql
-- Run this on a fresh table with 1000+ rows
EXPLAIN ANALYZE
SELECT script_id, COUNT(*), COUNT(*) FILTER (WHERE result = 'success')
FROM script_lead_outcomes
GROUP BY script_id;

-- GOOD: Should show "Index Scan using idx_outcomes_script_id"
-- BAD: Shows "Seq Scan on script_lead_outcomes"
```

**Which phase should address it:** Database schema creation phase (same migration that creates the table). Indexes are NOT an optimization — they are a requirement.

**Severity:** CRITICAL — performance issues from day one that get blamed on "Supabase is slow" or "Next.js is slow" when the real issue is missing indexes. Cannot be retrofitted without downtime on large tables.

---

## Important Pitfalls

Mistakes that cause significant rework or degrade feature quality.

---

### Pitfall 6: Inline Success/Fail Buttons Trigger Accidental Taps on Mobile

**What goes wrong:** PROJECT.md specifies "mobile-friendly UI (big tap targets for success/fail)." The temptation is to add success/fail buttons inline on each lead row:

```
[Lead Name] [Phone] [Niche] [✓ Success] [✗ Fail]
```

On desktop, this works fine. On mobile (especially while actively on a phone call), several problems emerge:

1. **Fat-finger errors:** User is on a call, reaches for their phone to mark success, accidentally taps the lead row instead of the button. The lead detail page opens. They hit back, try again, accidentally tap the adjacent lead's button. Now the wrong lead is marked.

2. **Tap target overlap:** Touch targets need 48x48px minimum (Apple HIG) or 48dp (Android Material). Two buttons side-by-side require 96px+ width. On a 375px mobile screen (iPhone SE), this leaves only ~280px for lead name/phone/niche. The row feels cramped.

3. **No confirmation:** Inline buttons are instant-action. One accidental tap marks a lead as "fail" with no undo. The user was reaching for the success button while balancing the phone between shoulder and ear, missed, and now the data is wrong.

4. **State confusion during calls:** User is on a call with Lead A, looking at their screen. The leads list is visible. They finish the call, mark success. But which lead is expanded? Are they SURE they tapped Lead A's button and not Lead B?

**Why it happens:** "Big tap targets" is interpreted as "make the buttons big" rather than "design a tap-optimized workflow." Inline buttons are the standard pattern for desktop tables, so they get ported to mobile without considering the usage context: user is distracted (on a phone call), single-handed operation, small screen.

**Consequences:**
- High rate of mis-marked outcomes (marked wrong lead, or success instead of fail)
- User frustration: "I keep hitting the wrong button"
- Data accuracy degrades (outcomes marked on wrong leads)
- Users stop using mobile UI, wait until back at desktop, defeating the purpose

**Warning signs:**
- Success/fail buttons appear inline in a table or list view
- No tap confirmation or undo mechanism
- Tap targets smaller than 48x48px
- Button labels are icons-only (✓/✗) without text (harder to distinguish at a glance)

**Prevention:**

**Pattern 1: Expand-then-act workflow (recommended for mobile)**
```
1. User taps lead row → Lead detail expands (or opens full-screen modal)
2. Full-screen view shows lead info + large call script + LARGE success/fail buttons
3. Buttons are full-width or half-width (150px+ each), impossible to mis-tap
4. After marking, show confirmation toast: "Lead X marked as Success ✓" with [Undo] button (5-second timeout)
```

This matches the "admin tool philosophy (all fields optional)" by making the action deliberate, not accidental.

**Pattern 2: Swipe gestures (iOS/Android native pattern)**
```
Swipe right on lead row → Success (green)
Swipe left on lead row → Fail (red)
```

Requires more implementation effort (gesture library like `react-swipeable`), but very natural for mobile-first workflows. Still needs visual feedback and undo.

**Pattern 3: Dedicated "Mark Outcome" screen**
```
After ending a call, user taps "Mark Outcome" floating action button
Modal shows:
  - Which lead? [Dropdown/search]
  - Outcome? [✓ Success] [✗ Fail] (large buttons)
  - Which script? [Dropdown]
  - Notes? [Optional text area]
  - [Cancel] [Save]
```

This works well for workflows where outcomes are batched ("I just made 10 calls, now I'll record outcomes").

**Which phase should address it:** Outcome tracking UI phase. The mobile workflow must be designed BEFORE implementing inline buttons.

**Severity:** IMPORTANT — degrades data accuracy and user experience, but can be fixed post-launch with UI refactor.

---

### Pitfall 7: Script Versioning Problem = No Historical Context

**What goes wrong:** User creates "Summer 2025 Intro Script" with specific talking points. Over 3 months, records 120 outcomes (68% success rate). In September, user updates the script text to "Fall 2025 Intro Script" with a different pitch. Over the next 3 months, records 90 outcomes (43% success rate).

The analytics show: "Fall 2025 Intro Script: 157 outcomes, 55% success rate overall."

This is **analytically meaningless**. The success rate is an average of two different scripts. The user cannot answer: "Did my script change improve or hurt performance?" The historical outcomes are divorced from the script content that produced them.

Worse: user deletes the "Fall 2025 Intro Script" in January to create "Winter 2026 Intro Script." Now 157 outcomes are orphaned (if using soft delete) or lost (if hard delete), and there is no way to reconstruct what script was used.

**Why it happens:** Scripts are treated as mutable content (like a Google Doc) rather than versioned artifacts. The initial implementation is `UPDATE call_scripts SET content = $1 WHERE id = $2` with no versioning. This works fine for the current script but loses historical context.

**Consequences:**
- Cannot compare script performance over time
- "Edit script" action retroactively changes analytics for past outcomes
- Cannot answer: "What was the script content when I achieved 73% success?"
- A/B testing is impossible (changing a script invalidates its historical data)

**Warning signs:**
- Scripts table has `content` column that gets overwritten on edit
- No `version` or `effective_date` tracking
- Analytics queries join outcomes to current script content, not the content at time of call
- No audit log of script changes

**Prevention:**

**Option 1: Immutable scripts with explicit versioning**
```sql
CREATE TABLE call_scripts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,  -- "Summer Intro"
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,  -- Only one version active at a time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, version)
);

-- When user "edits" a script, create a new version
INSERT INTO call_scripts (id, name, version, content, is_active)
SELECT gen_random_uuid(), name, MAX(version) + 1, $new_content, true
FROM call_scripts WHERE name = $name GROUP BY name;

-- Deactivate old version
UPDATE call_scripts SET is_active = false WHERE name = $name AND version < $new_version;
```

Outcomes link to script `id` (specific version). Analytics can compare "Summer Intro v1 vs v2."

**Option 2: Snapshot script content in outcomes**
```sql
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY,
  script_id UUID REFERENCES call_scripts(id),
  script_name_snapshot TEXT NOT NULL,  -- Copy script name at time of call
  script_content_snapshot TEXT,  -- Optional: full script text (if needed for audit)
  lead_id UUID REFERENCES leads(id),
  result TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

When outcome is created, copy `scripts.name` and optionally `scripts.content` into the outcome row. Even if script is edited/deleted, outcome retains what the script said at the time.

**Option 3: Simple timestamp-based approach (lightest weight)**
```sql
-- Add last_modified to scripts
ALTER TABLE call_scripts ADD COLUMN last_modified TIMESTAMPTZ DEFAULT NOW();

-- Add script_version_date to outcomes
ALTER TABLE script_lead_outcomes ADD COLUMN script_version_date TIMESTAMPTZ;

-- When creating outcome, record script's last_modified
INSERT INTO script_lead_outcomes (script_id, script_version_date, ...)
SELECT id, last_modified, ... FROM call_scripts WHERE id = $script_id;
```

This doesn't preserve content but allows analytics to show "outcomes before Sept 1 vs after Sept 1" to detect performance shifts.

**Recommendation for this project:**
Given "admin tool philosophy" and early-stage startup constraints, **Option 2 (snapshot script name)** is the right balance. Store `script_name_snapshot` in outcomes. If script is renamed/deleted, outcomes still show "was called 'Summer Intro'". Content snapshot is overkill unless regulatory compliance requires it.

**Which phase should address it:** Outcome tracking database schema phase. The snapshot column MUST exist from the first outcome.

**Severity:** IMPORTANT — historical analytics become unreliable, but not a day-one blocker (only matters after first script edit, which may be weeks/months away).

---

### Pitfall 8: Niche Analytics Query Uses Inefficient JOIN Pattern

**What goes wrong:** Niche-based analytics require joining three tables:

```
call_scripts → script_lead_outcomes → leads → niches
```

The query to show "success rate by niche for each script" looks like:

```sql
SELECT
  scripts.name AS script_name,
  niches.name AS niche_name,
  COUNT(*) FILTER (WHERE outcomes.result = 'success') AS successes,
  COUNT(*) AS total
FROM call_scripts scripts
JOIN script_lead_outcomes outcomes ON scripts.id = outcomes.script_id
JOIN leads ON outcomes.lead_id = leads.id
LEFT JOIN niches ON leads.niche_id = niches.id
GROUP BY scripts.id, niches.id
```

Without proper indexing, this query performs:
1. Sequential scan of outcomes (if missing index on script_id)
2. Nested loop join to leads (if missing index on outcomes.lead_id)
3. Hash join to niches (usually fast, small table)

At 10,000 outcomes and 5,000 leads, this query can take 1-3 seconds. The problem compounds with RLS: Supabase applies RLS filters to EACH table in the join, adding overhead.

**Why it happens:** Multi-table joins feel expensive, so developers try to avoid them. But the niche is stored on the lead, so the join is unavoidable. The mistake is not the join itself, but missing the indexes that make it efficient.

**Consequences:**
- "Performance by niche" analytics are slow (1-3s load time)
- Timeout errors on Supabase free tier (60s query timeout)
- User frustration: "the page hangs when I select niche filter"

**Warning signs:**
- Query `EXPLAIN ANALYZE` shows nested loop joins with high row counts
- Query duration increases superlinearly with outcome count (O(n²) behavior)
- Missing indexes on `outcomes.lead_id` or `leads.niche_id`

**Prevention:**

**Index strategy:**
```sql
-- Already recommended in Pitfall 5
CREATE INDEX idx_outcomes_lead_id ON script_lead_outcomes(lead_id);

-- Add index on leads.niche_id for the JOIN
CREATE INDEX idx_leads_niche_id ON leads(niche_id);

-- Composite index for the specific query pattern (if needed)
CREATE INDEX idx_outcomes_script_lead ON script_lead_outcomes(script_id, lead_id);
```

**Alternative: Denormalize niche into outcomes (trade-off)**
```sql
-- Add niche snapshot to outcomes (similar to script snapshot)
ALTER TABLE script_lead_outcomes ADD COLUMN niche_name_snapshot TEXT;

-- On outcome creation, copy lead's niche name
INSERT INTO script_lead_outcomes (script_id, lead_id, niche_name_snapshot, ...)
SELECT $script_id, $lead_id, niches.name, ...
FROM leads JOIN niches ON leads.niche_id = niches.id
WHERE leads.id = $lead_id;
```

Now the analytics query is:
```sql
SELECT script_name, niche_name_snapshot, COUNT(*), ...
FROM script_lead_outcomes
GROUP BY script_name, niche_name_snapshot
```

No joins, extremely fast. Downside: if niche is renamed, outcomes retain old name (but this might be GOOD for historical accuracy).

**Recommendation:**
Start with proper indexes (cheap, no schema changes). If queries are still slow, consider denormalization in a later phase.

**Which phase should address it:** Database schema phase (indexes), or outcome creation phase (denormalization).

**Severity:** IMPORTANT — degrades analytics performance but does not break functionality. Can be fixed post-launch with indexes.

---

### Pitfall 9: No Rate Limiting on Outcome Creation = Accidental Duplicate Entries

**What goes wrong:** User marks a lead as "Success" on mobile. The button is tapped. Network is slow (bad cell signal). No visual feedback appears. User taps again. And again. The request finally completes — three outcomes are created for the same lead with the same script, all timestamped within 2 seconds.

Analytics now show: "Script A: 3 outcomes on Lead X today." But there was only one call.

Worse: on a table view with inline buttons (Pitfall 6), scrolling can trigger accidental taps. A user scrolls past a success button, the touch registers as a tap, outcome is created, user doesn't notice until reviewing analytics.

**Why it happens:** No client-side or server-side deduplication. The outcome creation flow is:

```typescript
async function markOutcome(leadId: string, scriptId: string, result: 'success' | 'fail') {
  await supabase.from('script_lead_outcomes').insert({
    lead_id: leadId,
    script_id: scriptId,
    result: result
  })
}
```

Every button tap triggers an insert. No check for "did I already mark this lead with this script today?"

**Consequences:**
- Inflated outcome counts (analytics show 3 calls when only 1 happened)
- Success rate accuracy degrades (if user accidentally double-taps "Success", rate is artificially high)
- Data cleanup burden (manually deleting duplicate outcomes)

**Warning signs:**
- Multiple outcomes for same lead + script within seconds/minutes
- Analytics show more outcomes per day than plausible call volume
- Users report "I think I accidentally marked it twice"
- No loading state or disabled button after tap

**Prevention:**

**Client-side: Optimistic UI + debounce**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

async function markOutcome(leadId, scriptId, result) {
  if (isSubmitting) return  // Prevent double-tap

  setIsSubmitting(true)
  try {
    await supabase.from('script_lead_outcomes').insert({ ... })
    // Show success toast
  } catch (error) {
    // Show error toast
  } finally {
    setIsSubmitting(false)
  }
}

// Button disabled during submission
<button disabled={isSubmitting} onClick={() => markOutcome(...)}>
  {isSubmitting ? 'Saving...' : 'Success'}
</button>
```

**Server-side: Unique constraint (if outcomes should be unique per lead+script+day)**
```sql
-- If business rule is "only one outcome per lead per script per day"
CREATE UNIQUE INDEX idx_outcomes_unique_daily
ON script_lead_outcomes(lead_id, script_id, DATE(created_at));

-- Attempt to insert duplicate will fail with unique constraint violation
```

This is a BUSINESS RULE decision: Can you call the same lead with the same script multiple times per day? If YES (e.g., left voicemail at 9am, called back at 2pm), then DON'T add this constraint. If NO (one outcome per lead per script per day), then this constraint is the right safety net.

**Alternative: Deduplication check before insert**
```typescript
// Check for recent outcome (within last hour)
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
const { data: recent } = await supabase
  .from('script_lead_outcomes')
  .select('id')
  .eq('lead_id', leadId)
  .eq('script_id', scriptId)
  .gte('created_at', oneHourAgo)
  .single()

if (recent) {
  alert('You already marked this lead within the last hour. Skip duplicate?')
  return
}

// Proceed with insert
```

**Which phase should address it:** Outcome tracking UI phase (client-side) and database schema phase (server-side constraint if applicable).

**Severity:** IMPORTANT — degrades data accuracy but does not break features. Fixable with UI improvements and optional constraints.

---

### Pitfall 10: Script Content is Plain Text = No Formatting or Readability

**What goes wrong:** Call scripts are stored as plain text (`content TEXT`). User creates a script:

```
Intro: Hi, my name is...
Pitch: We offer...
Objection handling: If they say X, respond with Y...
Close: Can I schedule a demo?
```

In the database, this is stored as one long string with `\n` newlines. When displayed in the UI, it renders as a single paragraph block unless explicitly parsed. The script becomes hard to read during an active call.

User tries to add formatting (bold, bullet points, headers) by typing Markdown:

```
**Intro:** Hi, my name is...
- Benefit 1
- Benefit 2
```

The UI displays the literal `**Intro:**` text instead of rendering it as bold. Now the script looks worse, not better.

**Why it happens:** Plain text fields are the simplest implementation (`<textarea>`), but call scripts benefit from structured formatting. Users expect basic formatting (headings, lists, bold) but plain text cannot represent it.

**Consequences:**
- Scripts are hard to scan during calls (wall of text)
- Users cannot emphasize key points or structure objection handling
- Copy-pasting scripts from Google Docs loses all formatting
- Poor readability → callers skip parts of the script → inconsistent pitch delivery

**Warning signs:**
- Users request "can I make this bold?" or "can I add bullet points?"
- Scripts stored as plain text in database
- UI renders script in `<pre>` or `<p>` without formatting
- No rich text editor in script creation form

**Prevention:**

**Option 1: Markdown with rendering (recommended for simplicity)**
```sql
-- Store as plain text, assume Markdown syntax
ALTER TABLE call_scripts ADD COLUMN content TEXT NOT NULL;
```

```tsx
// Render with a Markdown library (react-markdown, ~15KB gzipped)
import ReactMarkdown from 'react-markdown'

<ReactMarkdown>{script.content}</ReactMarkdown>
```

Pros: Simple storage, version control-friendly (plain text diffs), familiar syntax (Markdown)
Cons: Users need to know Markdown, no WYSIWYG

**Option 2: Rich text editor with HTML storage**
```sql
-- Store as HTML
ALTER TABLE call_scripts ADD COLUMN content TEXT NOT NULL;  -- Contains HTML
```

```tsx
// Use a lightweight rich text editor (Tiptap, Quill, ~50KB gzipped)
import { useEditor, EditorContent } from '@tiptap/react'

// Render HTML safely (dangerouslySetInnerHTML with sanitization)
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(script.content) }} />
```

Pros: WYSIWYG editing, familiar UX (like Google Docs)
Cons: Larger bundle size, HTML storage is verbose, XSS risk if not sanitized

**Option 3: Structured JSON (overkill for this use case)**
```json
{
  "sections": [
    { "heading": "Intro", "content": "Hi, my name is..." },
    { "heading": "Pitch", "content": "We offer..." }
  ]
}
```

Pros: Structured, allows custom UI per section type
Cons: Complex to edit, requires custom form builder

**Recommendation for this project:**
**Option 1 (Markdown)** is the right balance for an admin tool. Users can type `**bold**` and `- bullet` naturally, rendering is simple, and storage is plain text (easy to debug, export, version).

If users struggle with Markdown syntax, add a toolbar with "Insert Bold", "Insert List" buttons that inject Markdown syntax (`**text**`, `- item`).

**Which phase should address it:** Script CRUD implementation phase. Decide formatting strategy BEFORE building the script creation form.

**Severity:** IMPORTANT — affects usability and script effectiveness, but not a blocker (users can work around with manual formatting).

---

## Moderate Pitfalls

Mistakes that cause delays or minor technical debt.

---

### Pitfall 11: Analytics Date Range Filter Missing = Always Showing All-Time Data

**What goes wrong:** User opens "Script Performance" analytics. The page shows:

- Script A: 487 outcomes, 61% success rate
- Script B: 312 outcomes, 58% success rate
- Script C: 94 outcomes, 73% success rate

The user created Script C two weeks ago and wants to know: "Is Script C outperforming the old scripts, or is this just early variance?" But the analytics show all-time data. Script A has 6 months of data, Script C has 2 weeks. The comparison is meaningless.

User cannot answer:
- "Which script performed best THIS MONTH?"
- "Did success rates improve after I tweaked Script A last week?"
- "Show me only outcomes from the last 30 days"

**Why it happens:** Initial analytics implementation queries all outcomes with no date filter:

```sql
SELECT script_id, COUNT(*), ... FROM script_lead_outcomes GROUP BY script_id
```

Adding a date range filter feels like a "nice-to-have" feature to add later, but without it, the analytics lose value as soon as historical data accumulates.

**Consequences:**
- Cannot compare time periods (this month vs last month)
- Old scripts with lots of historical data dominate the rankings
- Seasonal trends invisible (summer vs winter performance)
- Users cannot isolate impact of script changes

**Warning signs:**
- Analytics queries have no WHERE clause on `created_at`
- No date range picker in UI (no "Last 7 days / Last 30 days / All time" filter)
- Analytics always show the same numbers regardless of when user checks

**Prevention:**

**Add date range filter to analytics UI:**
```tsx
const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

const dateFilter = {
  '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  '90d': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  'all': new Date(0)
}

let query = supabase.from('script_lead_outcomes').select('*')
if (dateRange !== 'all') {
  query = query.gte('created_at', dateFilter[dateRange].toISOString())
}
```

**Default to 30 days, not all-time:**
All-time data is rarely useful for operational decisions. Default to "Last 30 days" with the option to expand to "All time" for historical analysis.

**Add to RPC for server-side aggregation (when needed):**
```sql
CREATE OR REPLACE FUNCTION get_script_performance(start_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM script_lead_outcomes
  WHERE (start_date IS NULL OR created_at >= start_date)
  GROUP BY ...
END;
$$ LANGUAGE plpgsql;
```

**Which phase should address it:** Analytics implementation phase. Should be part of the initial analytics feature, not a later enhancement.

**Severity:** MODERATE — analytics work but provide misleading comparisons without date filtering. Can be added post-launch but reduces value until fixed.

---

### Pitfall 12: No "Notes" Field on Outcomes = Lost Context

**What goes wrong:** User calls a lead, marks "Fail", and remembers: "She said to call back in 3 months after Q2 budget is finalized." This is critical context, but there is nowhere to record it. The outcome table only has `script_id`, `lead_id`, `result`, `created_at`.

User works around by adding a note to the lead record ("Call back in 3 months"). But 3 months later, reviewing failed outcomes, the user sees "Lead X: Fail" with no context about WHY it failed or what the next step is.

Worse: multiple outcomes on the same lead overwrite each other's context. Lead X has 3 failed calls over 6 months. Each failure had different objections, but the lead notes show only the most recent.

**Why it happens:** Outcome tracking is designed as a binary metric (success/fail) without considering qualitative context. The initial schema is minimal:

```sql
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY,
  script_id UUID,
  lead_id UUID,
  result TEXT CHECK (result IN ('success', 'fail')),
  created_at TIMESTAMPTZ
);
```

Notes feel like a "nice-to-have" until users start using the system and realize they need to capture objections, follow-up dates, and call context.

**Consequences:**
- Lost context: "Why did this call fail?" requires memory or checking external notes
- Cannot analyze failure patterns: "What are the top objections for Script A?"
- Follow-up planning harder: "Which failed leads are worth retrying?"
- Data is quantitative only, no qualitative insights

**Warning signs:**
- Outcome table has no notes/memo field
- Users ask: "Where do I write why the call failed?"
- External notes system (spreadsheet, sticky notes) used alongside CRM

**Prevention:**

**Add optional notes field:**
```sql
ALTER TABLE script_lead_outcomes ADD COLUMN notes TEXT DEFAULT NULL;
```

**UI considerations:**
- Notes are OPTIONAL (admin tool philosophy)
- Show notes field inline when marking outcome (not a separate step)
- Placeholder text guides usage: "Objections, follow-up date, or call context"
- Character limit (500-1000 chars) to keep notes concise

**Example UI flow:**
```tsx
<dialog>
  <h2>Mark Outcome for {lead.name}</h2>
  <label>Result:</label>
  <button onClick={() => setResult('success')}>Success</button>
  <button onClick={() => setResult('fail')}>Fail</button>

  <label>Notes (optional):</label>
  <textarea
    placeholder="e.g., 'Call back in 3 months', 'Objection: too expensive', 'Interested but not now'"
    maxLength={500}
  />

  <button>Save</button>
</dialog>
```

**Analytics enhancement (future):**
Once notes exist, add "Top objections" analysis by parsing common phrases in failed outcome notes.

**Which phase should address it:** Outcome tracking schema phase. Notes column should exist from day one (even if UI doesn't expose it initially).

**Severity:** MODERATE — feature works without notes, but limits long-term value. Easy to add column later, but retroactive notes cannot be captured.

---

### Pitfall 13: Niche Dropdown Performance Degrades with 100+ Options

**What goes wrong:** After 6 months, users have created 120 niches (even with normalization). The "Select niche" dropdown on the Add Lead form loads all 120 options. On desktop, this is usable (scrollable). On mobile, scrolling through 120 options is painful.

Worse: no search/filter in the dropdown. User wants "Restaurant" but has to scroll past "Auto Repair", "Construction", "Dental", ... 40 entries to find it.

**Why it happens:** The combo selector is implemented as a standard HTML `<select>`:

```tsx
<select name="niche_id">
  <option value="">Select niche</option>
  {niches.map(n => <option value={n.id}>{n.name}</option>)}
</select>
```

This works fine for 10-20 options but degrades at 100+.

**Consequences:**
- Slow niche selection on mobile
- Users frustrated by scrolling
- Users create duplicate niches because they can't find the existing one ("I'll just type it again")

**Warning signs:**
- Dropdown has 50+ options
- No search/autocomplete
- Users report "I can't find my niche in the list"
- Duplicate niches created due to poor discoverability

**Prevention:**

**Use searchable combo box (not plain dropdown):**

Option 1: **shadcn/ui Combobox** (already using shadcn for other components)
```tsx
import { Combobox } from '@/components/ui/combobox'

<Combobox
  options={niches.map(n => ({ label: n.name, value: n.id }))}
  placeholder="Search or create niche..."
  onCreate={(name) => createNiche(name)}
/>
```

Allows typing to filter, arrow keys to navigate, Enter to select. Mobile-friendly.

Option 2: **Native datalist** (no dependencies, but limited styling)
```tsx
<input list="niches" name="niche_name" placeholder="Type or select niche" />
<datalist id="niches">
  {niches.map(n => <option value={n.name} />)}
</datalist>
```

Simple but less control over behavior.

**Pagination/lazy loading (overkill for this use case):**
Only load top 20 niches initially, load more on scroll. Adds complexity for minimal gain at 100-200 niches.

**Recommendation:**
Use shadcn Combobox (or similar searchable select component). The "create new" functionality can be inline: if user types a name that doesn't exist, show "Create 'Restaurants'" option.

**Which phase should address it:** Niche taxonomy UI phase. Start with searchable combo box from day one, even if there are only 5 niches initially.

**Severity:** MODERATE — usability degrades over time, but not a blocker. Can be refactored later, but better to start right.

---

### Pitfall 14: No "Last Called" Timestamp on Leads = Cannot Prioritize Follow-Ups

**What goes wrong:** User has 200 leads in the CRM. Some were called yesterday, some 6 months ago, some never called. The leads list shows:

- Lead A
- Lead B
- Lead C
- ...

No indication of recency. User cannot answer:
- "Which leads haven't been called in 30+ days?"
- "Show me leads I called last week that need follow-up"
- "Who's coldest (longest time since last call)?"

User works around by manually sorting a spreadsheet or relying on memory. The CRM provides no prioritization.

**Why it happens:** The outcome table has `created_at`, but this isn't denormalized to the leads table. Queries like "show me leads with no calls in 30 days" require a LEFT JOIN with aggregation:

```sql
SELECT leads.*, MAX(outcomes.created_at) AS last_called
FROM leads
LEFT JOIN script_lead_outcomes outcomes ON leads.id = outcomes.lead_id
GROUP BY leads.id
ORDER BY last_called DESC NULLS LAST
```

This query is expensive and not intuitive for a simple "sort by last called" feature.

**Consequences:**
- Cannot easily prioritize leads for follow-up
- Leads go cold because user forgets to re-engage
- Poor lead management UX (no "needs attention" indicator)

**Warning signs:**
- Leads list has no "last called" or "last contacted" column
- No way to filter "not called in X days"
- Users maintain external tracking for call cadence

**Prevention:**

**Option 1: Computed column (PostgreSQL generated column)**
```sql
-- Not directly possible (generated columns can't use subqueries)
-- So this approach won't work in Postgres
```

**Option 2: Denormalized `last_outcome_at` column with trigger**
```sql
ALTER TABLE leads ADD COLUMN last_outcome_at TIMESTAMPTZ DEFAULT NULL;

-- Trigger to update last_outcome_at when outcome is created
CREATE OR REPLACE FUNCTION update_lead_last_outcome()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET last_outcome_at = NEW.created_at
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_last_outcome
AFTER INSERT ON script_lead_outcomes
FOR EACH ROW EXECUTE FUNCTION update_lead_last_outcome();
```

Now queries are simple:
```sql
SELECT * FROM leads ORDER BY last_outcome_at DESC NULLS LAST;
```

**Option 3: Application-level update**
```typescript
// When creating outcome, also update lead
await supabase.from('script_lead_outcomes').insert({ lead_id, ... })
await supabase.from('leads').update({ last_outcome_at: new Date() }).eq('id', lead_id)
```

Simpler than trigger but requires discipline (every outcome creation must update lead).

**Recommendation:**
**Option 2 (trigger)** is most reliable. One-time setup, automatic maintenance, no application logic needed.

**Which phase should address it:** Outcome tracking database schema phase. Add column and trigger BEFORE outcomes are created.

**Severity:** MODERATE — usability issue that becomes more painful as lead count grows. Can be added later with backfill query.

---

## Minor Pitfalls

Mistakes that cause annoyance but are quickly fixable.

---

### Pitfall 15: No Default Script = User Forgets to Select Script When Marking Outcome

**What goes wrong:** User marks a lead as "Success" via a quick-action button. The form pops up:

```
Outcome: Success ✓
Script: [Select script ▼]
Notes: _______
[Save]
```

User clicks Save without selecting a script. The validation fails: "Script is required." User selects a script, clicks Save again. Minor friction, but on mobile (while distracted), this happens repeatedly.

Worse: if script is NOT required (nullable), outcomes are created with `script_id = NULL`. Analytics break: "Top performing scripts: [null] (34 outcomes), Script A (22 outcomes)."

**Why it happens:** Script selection is a dropdown with no default. User is in a hurry (just finished a call), wants to mark outcome quickly, skips the script field.

**Consequences:**
- Minor UX friction (extra tap to select script)
- If script is nullable: data quality degrades, analytics show NULL entries

**Warning signs:**
- Outcome form has script dropdown with no default selected
- Users report "I always forget to pick a script"
- Analytics show outcomes with NULL script_id

**Prevention:**

**Option 1: Remember last-used script**
```typescript
// Save last script to localStorage
localStorage.setItem('last_script_id', scriptId)

// On form open, default to last-used script
const defaultScript = localStorage.getItem('last_script_id') || scripts[0]?.id
```

**Option 2: Always pre-select the first script**
```typescript
const [selectedScript, setSelectedScript] = useState(scripts[0]?.id)
```

**Option 3: Make script optional but flag in analytics**
If the workflow truly allows ad-hoc calls without a script, then `script_id` can be NULL, but display it clearly:
- "Unscripted calls: 12 outcomes"
- Filter option: "Show only scripted outcomes"

**Recommendation:**
**Option 1 (remember last-used)** provides the best UX for repetitive workflows (user calls 10 leads with the same script, doesn't need to re-select each time).

**Which phase should address it:** Outcome tracking UI phase.

**Severity:** MINOR — UX annoyance, not a functional issue. Easy fix with localStorage.

---

### Pitfall 16: "Success" and "Fail" Labels are Ambiguous

**What goes wrong:** User calls a lead. The lead answers, listens to pitch, says "I'm interested but call me back in 3 months." The user marks this as... Success or Fail?

- **Success:** They were interested and didn't hang up
- **Fail:** They didn't convert to a sale/meeting

Different users interpret this differently. After 6 months, analytics show "Script A: 68% success rate" but half of those "successes" are actually "interested but not now."

**Why it happens:** Binary success/fail categories are too simplistic for nuanced sales outcomes. Real call outcomes include:
- Interested, scheduled follow-up
- Interested but not now
- Not interested
- Wrong number / bad lead
- Voicemail left
- Gatekeeper blocked

Collapsing these into success/fail loses critical information.

**Consequences:**
- Analytics are ambiguous (success rate doesn't reflect actual conversion)
- Cannot analyze partial successes (interest vs conversion)
- Users define success differently, breaking comparisons

**Warning signs:**
- Only two outcome options: success/fail
- Users ask: "What counts as success?"
- Internal disagreement about how to categorize outcomes

**Prevention:**

**Option 1: Add outcome categories (beyond binary)**
```sql
ALTER TABLE script_lead_outcomes
ADD COLUMN result TEXT CHECK (result IN (
  'converted',        -- Scheduled meeting/demo/sale
  'interested',       -- Positive response but no commitment
  'not_interested',   -- Declined
  'voicemail',        -- Left message
  'bad_lead',         -- Wrong number, out of business
  'callback'          -- Requested callback at specific time
));
```

UI shows 6 buttons instead of 2. More accurate data.

**Option 2: Keep binary but add guidance**
```
Success = Scheduled meeting, demo, or sale
Fail = Declined, no answer, bad lead
```

Clear definition in UI tooltip or placeholder text.

**Option 3: Deferred decision**
Start with binary success/fail. After 1-2 months of usage, review actual outcomes (via notes field) and identify common patterns. Then expand categories based on real data.

**Recommendation for this project:**
**Option 2 (keep binary, add guidance)** for MVP. Clear definitions prevent ambiguity. If users report "I need more categories," expand in a later phase based on actual feedback.

**Which phase should address it:** Outcome tracking schema/UI phase. Decide outcome categories BEFORE collecting data.

**Severity:** MINOR — does not break functionality, but reduces analytical precision. Can be clarified with UI guidance.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database Schema | Orphaned outcomes (#1), missing RLS SELECT (#2), duplicate niches (#3), missing indexes (#5) | Soft delete scripts, RLS checklist, normalized niche names, index foreign keys immediately |
| Script CRUD | No versioning (#7), plain text formatting (#10) | Snapshot script name in outcomes, use Markdown with renderer |
| Outcome Tracking | Accidental taps (#6), duplicate entries (#9), no notes (#12) | Expand-then-act workflow, debounce + loading state, add notes column |
| Niche Taxonomy | Case-sensitive duplicates (#3), dropdown performance (#13) | Unique constraint on normalized name, searchable combo box |
| Analytics | Division by zero (#4), slow joins (#8), no date filter (#11) | NULL-safe aggregations, index foreign keys, default to 30-day range |
| Mobile UX | Tap target mistakes (#6), default script (#15) | Large buttons in full-screen modal, remember last-used script |

---

## Recommended Cross-Cutting Actions (Before Any Phase)

1. **Design outcome schema with full constraints** before implementing CRUD (foreign keys, indexes, RLS policies, notes column)
2. **Define niche normalization strategy** before the first niche is created (unique constraint on lowercased name)
3. **Add soft delete to scripts table** before delete functionality exists (deleted_at column, filter deleted by default)
4. **Create RLS policies in order: SELECT first** for all tables (scripts, outcomes, niches)
5. **Index all foreign keys** immediately after table creation (script_id, lead_id, niche_id)
6. **Add last_outcome_at to leads table** with trigger to auto-update on outcome creation
7. **Design mobile workflow** before implementing inline buttons (expand-then-act, not inline tap)

---

## Integration Pitfalls with Existing System

Specific risks from adding these features to an existing CRM with leads, clients, visits, and orders.

---

### Pitfall 17: Cold Calling Client Shows Outcome Metrics on Wrong Tab

**What goes wrong:** The Cold Calling client has `client_type = 'leads_only'`, which hides the Orders, Pipeline, Analytics, and Visits tabs (per PROJECT.md design). But script performance analytics are specific to Cold Calling.

If analytics are added to the existing Analytics tab (which Cold Calling doesn't show), users cannot access them. If analytics are added to the Leads tab, it clutters the lead list with charts and metrics.

**Prevention:**
- Add a new "Scripts" tab that ONLY shows for `client_type = 'leads_only'`
- Alternatively, add a "Call Scripts" section within the Leads tab for Cold Calling client
- Update `getNavItems()` function to include Scripts tab conditionally

**Which phase should address it:** Analytics UI phase. Tab structure must be planned before implementing analytics.

**Severity:** MINOR — UX design decision, not a data issue. Easy to adjust post-launch.

---

### Pitfall 18: Outcome Timestamps Conflict with Lead Event Audit Log

**What goes wrong:** The existing system has `lead_event` table for audit logging (tracks lead edits). When an outcome is created, should this also create a lead_event? If yes, the lead_event table becomes noisy (every outcome creates an event). If no, the audit trail is incomplete (cannot see "Lead was called on DATE" in the event log).

**Prevention:**
- Decide: are outcomes audit events?
- If YES: create lead_event on outcome creation with `event_type = 'outcome_recorded'`
- If NO: outcomes are separate from audit log, viewed via "Outcome history" section on lead detail page

**Recommendation:** Outcomes are NOT audit events (they are analytics data, not change events). Show outcomes in a separate "Call History" section on lead detail, not in the audit log.

**Which phase should address it:** Outcome tracking implementation phase.

**Severity:** MINOR — data model decision, no functional impact. Choose early to avoid refactoring later.

---

## Sources

- [Top 10 CRM Implementation Mistakes and How to Avoid Them in 2026](https://www.hyegro.com/blog/crm-implementation-mistakes) — User adoption and data quality issues
- [7 CRM Challenges & How to Overcome Them [2026]](https://blog.salesflare.com/crm-challenges) — Over-complexity and manual data entry burdens
- [When CRMs Go Bad: Lessons Learned from Common Pitfalls](https://blog.secretsourcemarketing.com/double-digit/crm-implementing) — Over-customization and training failures
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — Missing indexes and policy inefficiencies
- [Supabase Row Level Security Complete Guide](https://designrevision.com/blog/supabase-row-level-security) — RLS disabled without policies trap
- [ON DELETE CASCADE in Databases: Complete 2026 Guide](https://copyprogramming.com/howto/on-delete-cascade-meaning-in-database) — Orphaned records and cascade behavior
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes) — Foreign key cascade options
- [Touch Targets on Touchscreens - Nielsen Norman Group](https://www.nngroup.com/articles/touch-target-size/) — 48x48px minimum tap targets
- [Improving Tap Targets for Better Mobile UX](https://blog.openreplay.com/improving-tap-targets-mobile-ux/) — Spacing and rage tap detection
- [Mobile Accessibility Target Sizes Cheatsheet](https://smart-interface-design-patterns.com/articles/accessible-tap-target-sizes/) — iOS/Android guidelines
- [Content Management System: Versioning](https://softwaremill.com/content-management-system-versioning/) — Script versioning challenges
- [Deep-Dive into Content Versioning](https://caisy.io/blog/content-versioning-deep-dive) — Versioning best practices
- [3 Aggregation Mistakes When Reporting Forecast Accuracy](https://blog.arkieva.com/forecast-accuracy-aggregation-mistakes/) — Division by zero and averaging ratios
- [Data Accuracy in 2026: What It Is & How to Ensure](https://airbyte.com/data-engineering-resources/data-accuracy) — Sparse data and aggregation accuracy
- [DBMS Integrity Constraints - GeeksforGeeks](https://www.geeksforgeeks.org/dbms/dbms-integrity-constraints/) — Referential integrity fundamentals
- [DB Design - KnowledgeShop](https://fizalihsan.github.io/technology/db-design.html) — Database inheritance patterns and anti-patterns
- [Antipatterns in software classification taxonomies - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121222000826) — Taxonomy design mistakes
