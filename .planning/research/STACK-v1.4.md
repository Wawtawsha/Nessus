# Stack Research: Cold Calling Scripts (v1.4)

**Project:** Nessus CRM
**Milestone:** v1.4 Cold Calling Scripts
**Researched:** 2026-02-15

## Executive Summary

For cold calling script management, outcome tracking, niche taxonomy, and analytics, the existing Next.js 14 + Supabase stack requires minimal additions. The core infrastructure (Next.js 14, Supabase client-side queries, shadcn/ui, Tailwind) handles all requirements. Three new shadcn/ui components are needed: **Command**, **Dialog**, and **Textarea**. For form validation, add **React Hook Form** + **Zod** for type-safe schema validation. Analytics leverage existing Supabase RPC pattern established in v1.1.

**Key principle:** Continue admin tool philosophy. No premature optimization. Simple, readable implementations.

---

## Recommended Stack Additions

### Form Management & Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-hook-form | ^7.71.0 | Form state management | Minimal re-renders, simple API, de facto standard for React forms. Latest stable v7.x (v8 is beta). |
| zod | ^4.3.6 | Schema validation | TypeScript-first validation, reusable schemas for client + server. v4.x adds exclusive unions and file validation. |
| @hookform/resolvers | ^3.10.0 | React Hook Form + Zod bridge | Official adapter for using Zod schemas with React Hook Form |

**Rationale:**
- React Hook Form is lightweight (9.4kB gzipped), focuses on performance through uncontrolled components
- Zod provides single-source-of-truth schemas that generate both runtime validation AND TypeScript types
- Existing "Add Lead" form uses native HTML dialog; scripts CRUD will use shadcn Dialog for consistency and better UX (focus trapping, accessibility)
- No server actions needed — client-side Supabase calls match existing pattern

**Integration with existing stack:**
```typescript
// Reusable schema pattern:
const scriptSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  niche: z.string().optional(),
});

// Use in form:
const { register, handleSubmit } = useForm({
  resolver: zodResolver(scriptSchema),
});
```

### shadcn/ui Component Additions

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| **Command** | Combobox base for niche selector | @radix-ui/react-command (cmdk) |
| **Dialog** | Script CRUD modals | @radix-ui/react-dialog |
| **Textarea** | Multi-line script body input | None (native) |

**Installation:**
```bash
npx shadcn@latest add command dialog textarea
```

**Why these components:**

**Command + Combobox pattern:**
- shadcn Combobox = Popover + Command (both needed)
- Enables "search existing or create new" niche taxonomy
- Already has Popover from v1.1
- Command provides fuzzy search, keyboard navigation, accessible ARIA patterns
- Perfect for user-managed dropdown with inline creation

**Dialog:**
- Replaces native HTML `<dialog>` for script forms
- Focus trapping, ESC key handling, backdrop click to close
- Portal rendering (prevents z-index issues)
- Better accessibility (ARIA roles, screen reader support)
- Consistent with shadcn ecosystem (unlike native dialog)

**Textarea:**
- Native-based styled component for script body
- Auto-resize capability
- Accessible labels and error states

**Why NOT alternatives:**
- **NOT** Formik — heavier, more complex API than React Hook Form
- **NOT** Yup — Zod is TypeScript-native, Yup has weaker inference
- **NOT** headlessui Dialog — already committed to Radix UI via shadcn
- **NOT** custom combobox — reinventing the wheel, accessibility is hard

---

## No Changes Required

### Database Layer
**Continue using:** Supabase client-side queries with RLS

**Why no changes:**
- Script CRUD = simple INSERT/UPDATE/DELETE on `scripts` table
- Outcome tracking = INSERT into `script_lead_outcomes` junction table
- Niche options stored as JSONB or separate `niches` lookup table
- Analytics via RPC functions (established pattern from v1.1 `get_revenue_by_period`)

**RPC for analytics:**
```sql
CREATE OR REPLACE FUNCTION get_script_performance(p_client_id UUID)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  total_uses INT,
  success_count INT,
  fail_count INT,
  success_rate NUMERIC
) AS $$
  SELECT
    s.id,
    s.title,
    COUNT(slo.id) AS total_uses,
    SUM(CASE WHEN slo.outcome = 'success' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN slo.outcome = 'fail' THEN 1 ELSE 0 END) AS fail_count,
    ROUND(
      100.0 * SUM(CASE WHEN slo.outcome = 'success' THEN 1 ELSE 0 END) /
      NULLIF(COUNT(slo.id), 0),
      2
    ) AS success_rate
  FROM scripts s
  LEFT JOIN script_lead_outcomes slo ON s.id = slo.script_id
  WHERE s.client_id = p_client_id
  GROUP BY s.id, s.title
  ORDER BY success_rate DESC NULLS LAST;
$$ LANGUAGE sql;
```

**Why this works:**
- PostgreSQL aggregates (COUNT, SUM, CASE) are performant for analytics queries
- JSONB aggregation NOT needed (simple counts, not complex nesting)
- RLS on tables = RPC inherits permissions
- Client-side `.rpc('get_script_performance', { p_client_id })` matches existing pattern

### Charting
**Continue using:** Recharts ^3.7.0

**Why no changes:**
- Already installed for revenue charts (v1.1)
- BarChart or PieChart for script performance visualization
- Responsive, accessible, well-documented

### Styling
**Continue using:** Tailwind CSS ^3.4.0 + shadcn/ui

**Why no changes:**
- Existing button, popover components work for big success/fail buttons
- Mobile-first responsive patterns already established
- No CSS-in-JS needed for simple UI

---

## Architecture Integration Points

### Data Model (Supabase Tables)

**New tables:**

```sql
-- Scripts table
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script-lead outcomes junction
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'fail')),
  called_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(script_id, lead_id, called_at) -- Prevent duplicate same-second entries
);

-- Niches lookup (option 1: separate table)
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(client_id, name)
);

-- OR: Store niche directly on leads (option 2: simpler)
ALTER TABLE leads ADD COLUMN niche TEXT;
```

**Option 2 recommended:** Store `niche` directly on `leads` table. Simpler, no joins, user types or selects. Combobox suggests existing values via `SELECT DISTINCT niche FROM leads WHERE client_id = ?`.

**Why NOT option 1 (separate niches table):**
- Adds JOIN complexity for every query
- User can't freely type new niches (must INSERT first)
- Over-engineered for a taxonomy that may change frequently

### Component Structure

```
app/clients/[id]/cold-calling/
├── page.tsx                    # Main Cold Calling page
├── ScriptsSection.tsx          # Scripts list + CRUD buttons
├── ScriptDialog.tsx            # Create/Edit script modal
├── LeadDetailWithScript.tsx    # Lead detail + script outcome tracking
├── ScriptAnalytics.tsx         # Performance charts
└── NicheCombobox.tsx           # Reusable niche selector
```

**Data flow:**
1. **Scripts CRUD:** ScriptDialog → Supabase INSERT/UPDATE/DELETE → refetch scripts list
2. **Outcome tracking:** LeadDetail → click success/fail → INSERT into script_lead_outcomes
3. **Analytics:** ScriptAnalytics → Supabase RPC → Recharts BarChart

### State Management

**Continue pattern:** React Context for sync polling (SyncContext)

**New context (optional):** ScriptsContext for Cold Calling page script state

**Why optional:**
- If scripts rarely change, server state via `useEffect` + Supabase query is sufficient
- If real-time updates needed, add context with 60s polling (match SyncContext pattern)
- Start simple, add context only if UX demands it

---

## Installation Steps

```bash
cd crm-dashboard

# 1. Install form dependencies
npm install react-hook-form zod @hookform/resolvers

# 2. Add shadcn/ui components
npx shadcn@latest add command dialog textarea

# 3. Verify installations
npm list react-hook-form zod @hookform/resolvers
```

**Expected changes to package.json:**
```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-command": "^1.1.6",
    "@radix-ui/react-dialog": "^1.1.5",
    "react-hook-form": "^7.71.0",
    "zod": "^4.3.6"
  }
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Form library | React Hook Form | Formik | Heavier (15kB vs 9kB), more verbose API, less TypeScript-friendly |
| Schema validation | Zod | Yup | Weaker TypeScript inference, not TypeScript-first |
| Combobox | shadcn Command + Popover | Custom `<datalist>` | No search, poor UX for create-new flow |
| Dialog | shadcn Dialog (Radix) | Native HTML `<dialog>` | Less accessible, no focus trapping, inconsistent with existing shadcn components |
| Analytics | Supabase RPC | Client-side aggregation | RPC is faster, established pattern from v1.1 |
| Niche storage | TEXT column on leads | Separate niches table | Simpler, no joins, flexible for changing taxonomy |

---

## Performance Considerations

### Database Queries

**Scripts list:**
```sql
SELECT * FROM scripts WHERE client_id = ? ORDER BY created_at DESC;
```
- **Expected rows:** 5-50 scripts per client
- **Performance:** Instant with client_id index

**Niche autocomplete:**
```sql
SELECT DISTINCT niche FROM leads WHERE client_id = ? AND niche IS NOT NULL;
```
- **Expected rows:** 10-100 unique niches
- **Performance:** Fast with client_id index, DISTINCT is cheap at this scale

**Script performance analytics:**
```sql
-- Via RPC function (see above)
SELECT * FROM get_script_performance(?);
```
- **Expected rows:** 5-50 scripts
- **Performance:** Aggregation over junction table, fast with indexes on script_id, outcome

**Indexes needed:**
```sql
CREATE INDEX idx_scripts_client ON scripts(client_id);
CREATE INDEX idx_script_outcomes_script ON script_lead_outcomes(script_id);
CREATE INDEX idx_script_outcomes_lead ON script_lead_outcomes(lead_id);
CREATE INDEX idx_leads_client_niche ON leads(client_id, niche);
```

### Bundle Size Impact

| Addition | Size (gzipped) | Impact |
|----------|----------------|--------|
| react-hook-form | ~9.4 kB | Minimal |
| zod | ~13.7 kB | Minimal |
| @hookform/resolvers | ~2 kB | Negligible |
| @radix-ui/react-command | ~15 kB | Small |
| @radix-ui/react-dialog | ~8 kB | Minimal |
| **Total** | **~48 kB** | **Acceptable** |

**Context:** Next.js 14 already ships ~85kB for framework. Adding 48kB for form/UI primitives is standard for CRUD features.

---

## Security Considerations

### Input Validation

**Zod schemas prevent:**
- Empty script titles/bodies
- Excessively long inputs (add `.max()` constraints)
- Type mismatches (e.g., passing number where string expected)

**Example:**
```typescript
const scriptSchema = z.object({
  title: z.string().min(1, "Title required").max(255, "Title too long"),
  body: z.string().min(1, "Script body required").max(10000, "Script too long"),
  niche: z.string().max(100).optional(),
});
```

### RLS (Row Level Security)

**Scripts table:**
```sql
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY scripts_client_isolation ON scripts
  FOR ALL
  USING (client_id = auth.uid());
```

**Script outcomes table:**
```sql
ALTER TABLE script_lead_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY outcomes_via_script ON script_lead_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = script_lead_outcomes.script_id
        AND scripts.client_id = auth.uid()
    )
  );
```

**Why this matters:**
- Multi-tenant CRM = strict client data isolation
- RLS enforced at database level (not just application)
- Matches existing pattern from leads, orders, visits

---

## Migration Path

### Phase 1: Add Dependencies
```bash
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest add command dialog textarea
```

### Phase 2: Database Schema
```sql
-- Run in Supabase SQL editor
CREATE TABLE scripts (...);
CREATE TABLE script_lead_outcomes (...);
ALTER TABLE leads ADD COLUMN niche TEXT;
CREATE FUNCTION get_script_performance(...);
```

### Phase 3: Build Components
1. **ScriptDialog** — Zod schema + React Hook Form
2. **NicheCombobox** — Command component with DISTINCT query
3. **LeadDetailWithScript** — Success/fail buttons
4. **ScriptAnalytics** — RPC query + Recharts

### Phase 4: Integration
- Add "Scripts" tab to Cold Calling page
- Wire up CRUD operations
- Test outcome tracking flow
- Validate analytics calculations

---

## Open Questions

### Niche Taxonomy: Edit vs Delete

**Question:** Can users delete/rename niches after assignment to leads?

**Options:**
1. **No editing** — niche is just TEXT, shows all distinct values, no management UI
2. **Bulk rename** — "Rename 'Restaurant' to 'QSR' across 15 leads"
3. **Delete orphans** — Remove niches not assigned to any leads

**Recommendation:** Start with option 1 (no editing). If users request bulk operations, add separate "Manage Niches" admin section in Phase 2.

### Script Versioning

**Question:** When user edits script, do outcomes link to original or updated version?

**Options:**
1. **No versioning** — outcomes link to script ID, script body can change
2. **Snapshot on use** — Store script body in script_lead_outcomes at call time
3. **Full versioning** — script_versions table with history

**Recommendation:** Start with option 1 (no versioning). Outcomes track "this script was used" not "this exact wording was used". If version control needed, add script_versions table later.

### Success/Fail Definition

**Question:** What counts as "success"? Booked meeting? Positive response? User-defined?

**Recommendation:** Keep binary success/fail for MVP. Add `notes` TEXT field to script_lead_outcomes for context. If more granular outcomes needed (e.g., "Callback scheduled", "Not interested", "Wrong number"), add outcome_type ENUM later.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Form libraries | **HIGH** | React Hook Form + Zod are industry standard, well-documented, actively maintained |
| shadcn components | **HIGH** | Command and Dialog are established components, verified via official docs |
| Database schema | **HIGH** | Simple relational model, matches existing patterns |
| RPC analytics | **HIGH** | Proven pattern from v1.1, straightforward aggregations |
| Niche combobox UX | **MEDIUM** | Pattern is sound, but "create new vs select existing" UX needs testing |
| Performance at scale | **MEDIUM** | Queries are simple, but untested with >1000 leads per client |

---

## Sources

**React Hook Form:**
- [npm: react-hook-form versions](https://www.npmjs.com/package/react-hook-form?activeTab=versions)
- [React Hook Form releases](https://github.com/react-hook-form/react-hook-form/releases)
- [Next.js 14 + React Hook Form + Zod guide](https://www.imdos.in/blog/react-hook-form-validation-with-zod)
- [React Hook Form + Zod + Server Actions](https://medium.com/@ctrlaltmonique/how-to-use-react-hook-form-zod-with-next-js-server-actions-437aaca3d72d)

**Zod:**
- [Zod releases](https://github.com/colinhacks/zod/releases)
- [Zod v4 release notes](https://zod.dev/v4)
- [npm: zod](https://www.npmjs.com/package/zod)
- [Zod Schema Validation 2025](https://www.turing.com/blog/data-integrity-through-zod-validation)

**shadcn/ui Components:**
- [shadcn Combobox documentation](https://ui.shadcn.com/docs/components/radix/combobox)
- [shadcn Command documentation](https://ui.shadcn.com/docs/components/radix/command)
- [shadcn Dialog documentation](https://ui.shadcn.com/docs/components/radix/dialog)
- [Building Custom Combobox with shadcn/ui](https://afifm.medium.com/building-a-custom-combobox-with-remote-data-in-react-using-shadcn-ui-and-typescript-0f848bc71022)

**Supabase RPC:**
- [Supabase JavaScript RPC reference](https://supabase.com/docs/reference/javascript/rpc)
- [Mastering Supabase RPC guide](https://api.collegepressbox.com/blog/mastering-supabase-rpc-a-step-by-step-guide-1764800950)
- [Supabase RPC best practices](https://www.restack.io/docs/supabase-knowledge-supabase-rpc-guide)

**PostgreSQL Performance:**
- [PostgreSQL json_agg function](https://neon.com/docs/functions/json_agg)
- [Optimize PostgreSQL for Analytics Workloads](https://oneuptime.com/blog/post/2026-01-25-optimize-postgresql-analytics-workloads/view)
- [Postgres JSONB performance analysis](https://medium.com/geekculture/postgres-jsonb-usage-and-performance-analysis-cdbd1242a018)

---

## Summary

**Minimal stack additions, maximum leverage of existing infrastructure.**

**Add:**
- react-hook-form ^7.71.0 (form state)
- zod ^4.3.6 (schema validation)
- @hookform/resolvers ^3.10.0 (bridge)
- shadcn Command component (niche combobox)
- shadcn Dialog component (script modals)
- shadcn Textarea component (script body)

**Continue:**
- Supabase client-side queries + RLS
- Supabase RPC for analytics aggregation
- Recharts for visualization
- Tailwind + shadcn/ui for styling

**Do NOT add:**
- Server-side validation libraries (client-side Zod is sufficient)
- State management libraries (React Context + Supabase handles state)
- Alternative UI libraries (committed to shadcn ecosystem)
- Complex ORM (Supabase client is sufficient)

**Philosophy:** Simple, readable, iterative. Build the 80% case, defer edge cases (versioning, bulk niche management) until user feedback demands them.
