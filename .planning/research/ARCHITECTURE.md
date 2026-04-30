# Architecture Research: Cold Calling Scripts (v1.4)

**Researched:** 2026-02-15
**Confidence:** HIGH
**Scope:** Integration of scripts, outcome tracking, niche taxonomy, and analytics into existing CRM

---

## Executive Summary

The Cold Calling Scripts feature (v1.4) integrates into an existing Next.js 14 + Supabase CRM with established patterns for client-scoped data, inline editing, and client-side aggregations. The architecture introduces three new tables (`scripts`, `niches`, `script_lead_outcomes`) that integrate with the existing `leads` and `clients` tables via foreign keys and RLS policies.

**Critical Design Constraints:**
1. **No standalone counters** - All script metrics derive from per-lead outcomes in `script_lead_outcomes` table
2. **User-managed niche taxonomy** - Niches persist until manually removed, combo selector allows pick-or-create
3. **Phone-friendly UI** - Success/fail buttons must meet 48x48px touch target minimum (Android standard)
4. **Client-side Supabase only** - No backend server, all queries via Supabase client with RLS

**Integration Points:**
- Extends existing leads table with `niche_id` foreign key
- Reuses client-scoped query pattern (`addClientFilter` helper)
- Follows inline edit pattern from lead detail page (v1.2)
- Adopts RPC aggregation pattern from revenue charts (v1.1)

---

## Database Schema

### New Tables

#### `scripts` Table
```sql
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT title_not_empty CHECK (char_length(trim(title)) > 0),
  CONSTRAINT body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX idx_scripts_client_id ON scripts(client_id);
CREATE INDEX idx_scripts_is_active ON scripts(is_active) WHERE is_active = true;

COMMENT ON TABLE scripts IS
'Call scripts for cold calling workflow. Each script belongs to a client and can be marked active/inactive.';
```

**RLS Policies:**
```sql
-- Users can view scripts for their client(s)
CREATE POLICY scripts_select ON scripts FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

-- Users can insert scripts for their client(s)
CREATE POLICY scripts_insert ON scripts FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update/delete their client's scripts
CREATE POLICY scripts_update ON scripts FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY scripts_delete ON scripts FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );
```

#### `niches` Table
```sql
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT niche_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT niche_name_lowercase CHECK (name = lower(name))
);

CREATE INDEX idx_niches_name ON niches(name);

COMMENT ON TABLE niches IS
'User-managed business niche taxonomy. Names are stored in lowercase for consistent lookups. Global to all clients.';
```

**RLS Policies:**
```sql
-- All authenticated users can view niches
CREATE POLICY niches_select ON niches FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert new niches
CREATE POLICY niches_insert ON niches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can delete niches (if no leads reference it)
CREATE POLICY niches_delete ON niches FOR DELETE
  TO authenticated
  USING (true);
```

**Note:** The `UNIQUE` constraint on `name` prevents duplicates. The combo selector should use `ON CONFLICT DO NOTHING` or handle constraint violations gracefully.

#### `script_lead_outcomes` Table
```sql
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'fail')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Prevent duplicate outcomes for same script+lead
  CONSTRAINT unique_script_lead UNIQUE (script_id, lead_id)
);

CREATE INDEX idx_script_lead_outcomes_script_id ON script_lead_outcomes(script_id);
CREATE INDEX idx_script_lead_outcomes_lead_id ON script_lead_outcomes(lead_id);
CREATE INDEX idx_script_lead_outcomes_outcome ON script_lead_outcomes(outcome);

COMMENT ON TABLE script_lead_outcomes IS
'Per-lead outcomes for call scripts. Each script-lead pair can have ONE outcome (success or fail). Displayed counters aggregate from this table.';
```

**RLS Policies:**
```sql
-- Users can view outcomes for scripts they have access to
CREATE POLICY script_lead_outcomes_select ON script_lead_outcomes FOR SELECT
  USING (
    script_id IN (
      SELECT id FROM scripts
      WHERE client_id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

-- Users can insert outcomes for scripts they have access to
CREATE POLICY script_lead_outcomes_insert ON script_lead_outcomes FOR INSERT
  WITH CHECK (
    script_id IN (
      SELECT id FROM scripts
      WHERE client_id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update outcomes for scripts they have access to
CREATE POLICY script_lead_outcomes_update ON script_lead_outcomes FOR UPDATE
  USING (
    script_id IN (
      SELECT id FROM scripts
      WHERE client_id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete outcomes for scripts they have access to
CREATE POLICY script_lead_outcomes_delete ON script_lead_outcomes FOR DELETE
  USING (
    script_id IN (
      SELECT id FROM scripts
      WHERE client_id IN (
        SELECT client_id FROM user_clients WHERE user_id = auth.uid()
      )
    )
  );
```

**Performance Note:** These RLS policies use `IN (SELECT ...)` subqueries which are generally efficient for small-to-medium datasets. If performance becomes an issue, consider a security definer function to bypass RLS on the join table ([source: Supabase RLS Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)).

### Modified Tables

#### `leads` Table Extension
```sql
ALTER TABLE leads
ADD COLUMN niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_niche_id ON leads(niche_id);

COMMENT ON COLUMN leads.niche_id IS
'Business niche classification for analytics. Nullable to support leads not yet categorized.';
```

**Migration Considerations:**
- Existing leads will have `niche_id = NULL` (not yet categorized)
- No backfill required - users assign niches during lead edit or add workflows
- `ON DELETE SET NULL` ensures deleting a niche doesn't cascade delete leads

---

## Component Architecture

### Page Structure

The Cold Calling client shows **only** the Leads tab (enforced by `client_type='leads_only'` in `getNavItems()` function in `ClientAccordion.tsx`). The scripts management UI lives on the **Leads page** for the Cold Calling client, not a separate page.

**Rationale:** Keeps scripts co-located with the leads workflow rather than requiring navigation away.

#### Cold Calling Leads Page Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Leads (Cold Calling)                           [Add Lead]    │
├──────────────────────────────────────────────────────────────┤
│ ┌─ Scripts Section ─────────────────────────────────────┐    │
│ │ [Add Script] [View All Scripts]                       │    │
│ │                                                        │    │
│ │ Active Scripts (3):                                    │    │
│ │ ┌─────────────────────────────────────────────────┐   │    │
│ │ │ Script Card: "Dentist Cold Call v2"             │   │    │
│ │ │ Success: 12 | Fail: 8 | Win Rate: 60%          │   │    │
│ │ │ [Use Script]                                    │   │    │
│ │ └─────────────────────────────────────────────────┘   │    │
│ │ (more script cards...)                                 │    │
│ └────────────────────────────────────────────────────────┘    │
│                                                                │
│ ┌─ Filters ─────────────────────────────────────────────┐    │
│ │ [Search] [Status] [Niche] [Clear]                     │    │
│ └────────────────────────────────────────────────────────┘    │
│                                                                │
│ ┌─ Leads Table ─────────────────────────────────────────┐    │
│ │ Name | Contact | Niche | Status | Date               │    │
│ │ ...                                                    │    │
│ └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- **Scripts Section** (new) - Horizontal scrollable script cards with counters
- **Filters Section** (existing, extended) - Add niche filter dropdown
- **Leads Table** (existing, extended) - Add niche column

### New Components

#### `<ScriptManager>` Component
**Location:** `crm-dashboard/components/ScriptManager.tsx`
**Purpose:** Displays active scripts with aggregated counters and provides "Use Script" action
**Props:**
```typescript
interface ScriptManagerProps {
  clientId: string
  onUseScript: (scriptId: string) => void  // Opens script dialog for calling
}
```

**Features:**
- Fetches active scripts for current client
- Aggregates outcomes from `script_lead_outcomes` table client-side
- Displays: title, success count, fail count, win rate percentage
- "Add Script" button opens `<AddEditScriptDialog>`
- "Use Script" button opens `<ScriptCallDialog>` with script body

**Data Flow:**
```typescript
// Fetch scripts
const { data: scripts } = await supabase
  .from('scripts')
  .select('id, title')
  .eq('client_id', clientId)
  .eq('is_active', true)
  .order('created_at', { desc: true })

// Fetch outcomes for all scripts
const { data: outcomes } = await supabase
  .from('script_lead_outcomes')
  .select('script_id, outcome')
  .in('script_id', scripts.map(s => s.id))

// Aggregate client-side
const scriptStats = scripts.map(script => ({
  ...script,
  successCount: outcomes.filter(o => o.script_id === script.id && o.outcome === 'success').length,
  failCount: outcomes.filter(o => o.script_id === script.id && o.outcome === 'fail').length,
}))
```

**Performance Consideration:** For clients with many scripts (>20) or outcomes (>1000), this client-side aggregation could be slow. If performance becomes an issue, introduce an RPC function similar to `get_revenue_by_period` to aggregate in Postgres ([source: Supabase RPC for aggregations](https://supabase.com/blog/postgrest-aggregate-functions)).

#### `<AddEditScriptDialog>` Component
**Location:** `crm-dashboard/components/AddEditScriptDialog.tsx`
**Purpose:** Dialog for creating/editing scripts
**Pattern:** Native HTML `<dialog>` (matches Add Lead pattern from v1.2)

**Form Fields:**
- `title` (text input, required via client-side validation)
- `body` (textarea, required via client-side validation)
- `is_active` (checkbox, defaults to true on create)

**Submit Handler:**
```typescript
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const formData = new FormData(e.currentTarget)

  const payload = {
    client_id: currentClientId,
    title: formData.get('title') as string,
    body: formData.get('body') as string,
    is_active: formData.get('is_active') === 'on',
    created_by: (await supabase.auth.getUser()).data.user?.id,
  }

  const { error } = await supabase.from('scripts').insert(payload)

  if (!error) {
    dialogRef.current?.close()
    refreshScripts()
  }
}
```

**Edit Mode:** Same component, populate form with existing script data. Update query instead of insert.

#### `<ScriptCallDialog>` Component
**Location:** `crm-dashboard/components/ScriptCallDialog.tsx`
**Purpose:** Full-screen dialog showing script body with lead selector and outcome buttons
**Props:**
```typescript
interface ScriptCallDialogProps {
  scriptId: string
  scriptTitle: string
  scriptBody: string
  clientId: string
  onClose: () => void
}
```

**UI Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ [X] Close                   Dentist Cold Call v2             │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌─ Script Body ──────────────────────────────────────────┐   │
│ │ Hi [Name], I'm calling from [Company]...              │   │
│ │                                                         │   │
│ │ (full script body, scrollable)                         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌─ Lead Selection ───────────────────────────────────────┐   │
│ │ Calling: [Lead Selector Dropdown]                      │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌─ Outcome ──────────────────────────────────────────────┐   │
│ │ [  SUCCESS  ]  [   FAIL   ]                            │   │
│ │   (48x48px)      (48x48px)                             │   │
│ │                                                         │   │
│ │ Notes (optional):                                       │   │
│ │ [text area]                                             │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│                                    [Save Outcome]              │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Lead selector: dropdown of leads for current client (searchable)
- Success/Fail buttons: 48x48px minimum ([Android accessibility standard](https://support.google.com/accessibility/android/answer/7101858?hl=en))
- Notes field: optional additional context
- Save button: inserts/updates `script_lead_outcomes` record

**Data Flow:**
```typescript
const handleSaveOutcome = async (outcome: 'success' | 'fail') => {
  const { error } = await supabase
    .from('script_lead_outcomes')
    .upsert({
      script_id: scriptId,
      lead_id: selectedLeadId,
      outcome,
      notes: notesValue || null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }, {
      onConflict: 'script_id,lead_id'  // Update existing outcome
    })

  if (!error) {
    onClose()
    refreshScriptStats()
  }
}
```

**Existing Outcome Indicator:** When a lead is selected, check if an outcome already exists and display it above the buttons:
```typescript
const { data: existingOutcome } = await supabase
  .from('script_lead_outcomes')
  .select('outcome, notes, created_at')
  .eq('script_id', scriptId)
  .eq('lead_id', selectedLeadId)
  .single()

// UI: "Previous outcome: Success (2026-02-14) - Notes: 'Left voicemail'"
```

#### `<NicheComboBox>` Component
**Location:** `crm-dashboard/components/NicheComboBox.tsx`
**Purpose:** Combo selector for niche (pick existing or create new)
**Pattern:** shadcn/ui Combobox ([source](https://ui.shadcn.com/docs/components/radix/combobox))

**Installation:**
```bash
npx shadcn-ui@latest add combobox
```

**Props:**
```typescript
interface NicheComboBoxProps {
  value: string | null  // Current niche_id
  onChange: (nicheId: string | null) => void
  placeholder?: string
}
```

**Data Flow:**
```typescript
// Fetch all niches
const { data: niches } = await supabase
  .from('niches')
  .select('id, name')
  .order('name')

// User types new niche name not in list
const handleCreateNiche = async (newName: string) => {
  const normalized = newName.toLowerCase().trim()

  const { data, error } = await supabase
    .from('niches')
    .insert({ name: normalized })
    .select()
    .single()

  if (error?.code === '23505') {
    // Unique constraint violation - niche already exists
    // Fetch existing and select it
    const { data: existing } = await supabase
      .from('niches')
      .select('id')
      .eq('name', normalized)
      .single()
    onChange(existing.id)
  } else if (!error) {
    onChange(data.id)
  }
}
```

**shadcn Combobox Integration:**
The shadcn Combobox supports dynamic options based on query value ([source: Headless UI Combobox](https://headlessui.com/react/combobox)). When the user's input doesn't match any existing niche, show "Create: [input]" as an option.

**Deletion UX:** To remove unused niches, add a settings page with a niches list. Users can delete niches not referenced by any leads (enforce via foreign key constraint).

### Modified Components

#### Leads Page (`app/(dashboard)/leads/page.tsx`)
**Changes:**
1. Add `<ScriptManager>` component above filters (only for `client_type='leads_only'`)
2. Add niche filter dropdown to filters section
3. Add niche column to leads table
4. Extend query to join niches table:
```typescript
const { data: leads } = await supabase
  .from('leads')
  .select(`
    *,
    niches (
      id,
      name
    )
  `)
  .eq('client_id', currentClientId)
  .order('created_at', { desc: true })
```

**Conditional Script Section:**
```typescript
{currentClient?.client_type === 'leads_only' && (
  <ScriptManager
    clientId={currentClientId}
    onUseScript={(scriptId) => setActiveScriptId(scriptId)}
  />
)}
```

#### Lead Detail Page (`app/(dashboard)/leads/[id]/page.tsx`)
**Changes:**
1. Add niche field to both view mode and edit mode
2. Use `<NicheComboBox>` in edit mode
3. Log niche changes to `lead_events` table (follows existing pattern)

**Edit Form Extension:**
```typescript
const [editForm, setEditForm] = useState({
  // ...existing fields
  niche_id: null as string | null,
})

// In edit mode
<div>
  <label className="block text-sm font-medium text-gray-500 mb-1">Niche</label>
  <NicheComboBox
    value={editForm.niche_id}
    onChange={(nicheId) => setEditForm({ ...editForm, niche_id: nicheId })}
    placeholder="Select or create niche..."
  />
</div>
```

#### Add Lead Dialog (within Leads Page)
**Changes:**
1. Add niche field to form (optional)
2. Use `<NicheComboBox>` component

**No other changes needed** - form submission already handles nullable fields.

---

## Data Flow Diagrams

### Script Outcome Recording Flow
```
User clicks "Use Script" on ScriptManager
  ↓
<ScriptCallDialog> opens with script body
  ↓
User selects lead from dropdown
  ↓
(Check if script+lead outcome already exists)
  ↓
User clicks [SUCCESS] or [FAIL] button
  ↓
Insert/Update script_lead_outcomes table
  {
    script_id: UUID,
    lead_id: UUID,
    outcome: 'success' | 'fail',
    notes: TEXT,
    created_by: UUID
  }
  ↓
Close dialog, refresh ScriptManager counters
  ↓
Counters aggregate from script_lead_outcomes client-side
```

### Niche Assignment Flow (Create New)
```
User opens lead in edit mode
  ↓
Types "Dentistry" in NicheComboBox
  ↓
No match found in niches list
  ↓
Combobox shows "Create: Dentistry" option
  ↓
User selects "Create: Dentistry"
  ↓
Insert into niches table
  INSERT INTO niches (name) VALUES ('dentistry')
  ON CONFLICT (name) DO NOTHING  -- handles race conditions
  ↓
Fetch newly created niche ID
  ↓
Update editForm.niche_id = new_id
  ↓
User saves lead
  ↓
Update leads table SET niche_id = new_id WHERE id = lead_id
  ↓
Log lead_events: { field: 'niche_id', from: null, to: new_id }
```

### Script Analytics Aggregation Flow
```
ScriptManager mounts
  ↓
Fetch scripts for current client
  SELECT id, title FROM scripts
  WHERE client_id = ? AND is_active = true
  ↓
Fetch all outcomes for those scripts
  SELECT script_id, outcome FROM script_lead_outcomes
  WHERE script_id IN (...)
  ↓
Aggregate client-side
  successCount = outcomes.filter(o => o.outcome === 'success').length
  failCount = outcomes.filter(o => o.outcome === 'fail').length
  winRate = (successCount / (successCount + failCount)) * 100
  ↓
Display script cards with counters
```

**Performance Optimization (if needed):**
Replace client-side aggregation with RPC:
```sql
CREATE FUNCTION get_script_stats(p_client_id UUID)
RETURNS TABLE (
  script_id UUID,
  title TEXT,
  success_count BIGINT,
  fail_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    COUNT(*) FILTER (WHERE slo.outcome = 'success') AS success_count,
    COUNT(*) FILTER (WHERE slo.outcome = 'fail') AS fail_count
  FROM scripts s
  LEFT JOIN script_lead_outcomes slo ON slo.script_id = s.id
  WHERE s.client_id = p_client_id AND s.is_active = true
  GROUP BY s.id, s.title
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**When to use RPC:** If script counts take >500ms to calculate client-side ([source: Supabase debugging performance](https://supabase.com/docs/guides/database/debugging-performance)).

---

## Analytics Views

### Script Performance Dashboard
**Location:** New section on Cold Calling Analytics page
**Metrics:**
1. **Overall Script Performance:** Table showing all scripts with win rates
2. **Script by Niche:** Breakdown of script performance per niche (which scripts work best for dentists vs lawyers)
3. **Top Performing Scripts:** Scripts with highest win rates (min 10 outcomes for statistical significance)
4. **Lead Outcome History:** Timeline of outcomes per lead (shows calling persistence)

**Query Pattern (Script by Niche):**
```typescript
const { data: scriptNicheStats } = await supabase
  .from('script_lead_outcomes')
  .select(`
    script_id,
    outcome,
    leads!inner (
      niche_id,
      niches (name)
    )
  `)
  .eq('leads.client_id', currentClientId)

// Aggregate client-side by script_id + niche
const grouped = scriptNicheStats.reduce((acc, row) => {
  const key = `${row.script_id}-${row.leads.niche_id}`
  if (!acc[key]) {
    acc[key] = { scriptId: row.script_id, niche: row.leads.niches.name, success: 0, fail: 0 }
  }
  if (row.outcome === 'success') acc[key].success++
  else acc[key].fail++
  return acc
}, {})
```

**Chart Component:** Recharts BarChart showing win rates by niche for each script (follows existing pattern from RevenueChart).

---

## Build Order

The following build order respects dependencies and enables incremental testing:

### Phase 1: Database Foundation
**Goal:** Schema exists, RLS works, can CRUD in SQL console
**Files:**
- `crm-dashboard/supabase/migrations/07_cold_calling_scripts.sql`

**Tasks:**
1. Create `niches` table with RLS
2. Create `scripts` table with RLS
3. Create `script_lead_outcomes` table with RLS
4. Add `niche_id` column to `leads` table
5. Test RLS policies in Supabase dashboard

**Success Criteria:**
- Can insert/select/update/delete scripts via SQL for a test client
- Can insert/select niches
- Can insert script outcomes
- RLS prevents cross-client access

### Phase 2: TypeScript Types
**Goal:** TypeScript interfaces match database schema
**Files:**
- `crm-dashboard/types/script.ts` (new)
- `crm-dashboard/types/lead.ts` (extend)

**Tasks:**
1. Define `Script`, `Niche`, `ScriptLeadOutcome` interfaces
2. Extend `Lead` interface to include `niche_id` and joined `niches` object

### Phase 3: Niche Combo Box
**Goal:** Reusable niche selector component
**Files:**
- `crm-dashboard/components/ui/combobox.tsx` (shadcn install)
- `crm-dashboard/components/NicheComboBox.tsx` (new)

**Tasks:**
1. Install shadcn combobox: `npx shadcn-ui@latest add combobox`
2. Implement `<NicheComboBox>` with pick-or-create logic
3. Handle niche creation with `ON CONFLICT` handling
4. Test with standalone page before integrating

**Success Criteria:**
- Can select existing niche from list
- Can type new niche name and create it
- Duplicate names handled gracefully (lowercase normalization)
- Dropdown updates immediately after creation

### Phase 4: Lead Niche Integration
**Goal:** Users can assign/edit niche on leads
**Files:**
- `crm-dashboard/app/(dashboard)/leads/page.tsx` (extend)
- `crm-dashboard/app/(dashboard)/leads/[id]/page.tsx` (extend)

**Tasks:**
1. Add niche filter to leads page filters section
2. Add niche column to leads table (fetch with join)
3. Add `<NicheComboBox>` to Add Lead dialog
4. Add `<NicheComboBox>` to edit mode on lead detail page
5. Log niche changes to `lead_events`

**Success Criteria:**
- Can assign niche when adding new lead
- Can change niche in edit mode on lead detail page
- Niche displays in leads table
- Can filter leads by niche
- Niche changes logged to audit trail

### Phase 5: Script CRUD UI
**Goal:** Users can create/edit/delete scripts
**Files:**
- `crm-dashboard/components/AddEditScriptDialog.tsx` (new)
- `crm-dashboard/components/ScriptManager.tsx` (new, basic version)
- `crm-dashboard/app/(dashboard)/leads/page.tsx` (extend)

**Tasks:**
1. Implement `<AddEditScriptDialog>` as native HTML dialog
2. Add script list view to `<ScriptManager>` (no counters yet)
3. Conditionally show `<ScriptManager>` on Cold Calling leads page
4. Implement add/edit/delete handlers with Supabase client
5. Handle `is_active` toggle (soft delete)

**Success Criteria:**
- Can create new script from Cold Calling leads page
- Can edit existing script (opens pre-filled dialog)
- Can toggle script active/inactive
- Script list updates immediately after CRUD operations
- Only active scripts show by default

### Phase 6: Script Call Dialog
**Goal:** Users can use scripts and record outcomes
**Files:**
- `crm-dashboard/components/ScriptCallDialog.tsx` (new)
- `crm-dashboard/components/ScriptManager.tsx` (extend)

**Tasks:**
1. Implement `<ScriptCallDialog>` with full-screen layout
2. Add lead selector dropdown (fetch leads for current client)
3. Implement Success/Fail buttons (48x48px touch targets)
4. Add optional notes field
5. Implement outcome save handler (upsert to `script_lead_outcomes`)
6. Show existing outcome indicator when lead selected
7. Wire "Use Script" button from `<ScriptManager>`

**Success Criteria:**
- Can open script dialog from ScriptManager
- Script body displays correctly
- Can select lead from dropdown
- Success/Fail buttons are phone-friendly (48x48px)
- Outcome saves to database
- If outcome already exists, shows previous result and allows update
- Dialog closes after save

### Phase 7: Script Statistics
**Goal:** Counters display on script cards
**Files:**
- `crm-dashboard/components/ScriptManager.tsx` (extend)

**Tasks:**
1. Fetch `script_lead_outcomes` for all scripts
2. Aggregate client-side: success count, fail count, win rate
3. Display counters on script cards
4. Refresh counters after outcome save
5. Add loading states during aggregation

**Success Criteria:**
- Script cards show: "Success: 12 | Fail: 8 | Win Rate: 60%"
- Counters update immediately after recording outcome
- Zero-outcome scripts show: "Success: 0 | Fail: 0 | Win Rate: —"
- Loading spinner during initial fetch

### Phase 8: Script Analytics Dashboard
**Goal:** Analytics view for script performance
**Files:**
- `crm-dashboard/app/(dashboard)/analytics/page.tsx` (extend for Cold Calling client)
- `crm-dashboard/app/(dashboard)/analytics/components/ScriptAnalytics.tsx` (new)

**Tasks:**
1. Add conditional section to analytics page for `client_type='leads_only'`
2. Implement "Overall Script Performance" table
3. Implement "Script by Niche" breakdown chart
4. Implement "Top Performing Scripts" list (min 10 outcomes filter)
5. Implement "Lead Outcome History" timeline view

**Success Criteria:**
- Analytics page shows script metrics when Cold Calling client selected
- Can identify which scripts work best overall
- Can identify which scripts work best per niche
- Can see outcome history for individual leads

### Phase 9: Performance Optimization (if needed)
**Goal:** Aggregations complete in <500ms
**Files:**
- `crm-dashboard/supabase/migrations/08_script_stats_rpc.sql` (if needed)
- `crm-dashboard/components/ScriptManager.tsx` (switch to RPC)

**Tasks:**
1. Monitor aggregation performance in production
2. If slow, implement `get_script_stats()` RPC function
3. Replace client-side aggregation with RPC call
4. Benchmark performance improvement

**Trigger:** Only implement if Phase 7 shows performance issues.

---

## Integration Risks & Mitigations

### Risk 1: Niche Name Collisions (Race Conditions)
**Scenario:** Two users create "dentistry" niche simultaneously
**Impact:** Unique constraint violation error
**Mitigation:**
```typescript
try {
  const { data, error } = await supabase
    .from('niches')
    .insert({ name: normalized })
    .select()
    .single()

  if (error?.code === '23505') {
    // Unique constraint violation - fetch existing
    const { data: existing } = await supabase
      .from('niches')
      .select('id')
      .eq('name', normalized)
      .single()
    onChange(existing.id)
    return
  }

  onChange(data.id)
} catch (err) {
  console.error('Niche creation failed:', err)
}
```

### Risk 2: Script Outcome Update Conflicts
**Scenario:** User records outcome for script+lead, then opens dialog again and changes it
**Impact:** Could create duplicate rows if not using upsert
**Mitigation:** Use `UNIQUE (script_id, lead_id)` constraint and upsert

### Risk 3: Client-Side Aggregation Performance
**Scenario:** Client with 50 scripts and 5000 outcomes causes slow UI
**Impact:** Script counters take 2-3 seconds to load
**Mitigation:** Start with client-side aggregation (simpler), monitor performance, add RPC if needed (Phase 9).

**Performance Budget:**
- Acceptable: <500ms for aggregation
- Degraded: 500ms-2s (consider RPC)
- Unacceptable: >2s (must implement RPC)

### Risk 4: RLS Performance on Junction Table
**Scenario:** `script_lead_outcomes` RLS checks scripts table for every row
**Impact:** Slow queries on large outcome datasets
**Mitigation:** Follow Supabase RLS best practices (index columns, use `IN (SELECT)` pattern, security definer function if needed)

### Risk 5: Mobile Button Size Compliance
**Scenario:** Success/Fail buttons too small on phone
**Impact:** Frustrated users, misclicks
**Mitigation:** Enforce 48x48px minimum ([Android standard](https://support.google.com/accessibility/android/answer/7101858?hl=en))

---

## Deferred Decisions

1. **Script versioning** - No for MVP, but table supports it (add `version` column later if needed)
2. **Bulk outcome entry** - No for MVP, optimize for single-lead workflow first
3. **Script templates** - No for MVP, users bring their own
4. **Outcome timestamps** - Use `created_at` as proxy for "call time" in MVP
5. **Lead call history** - Yes, but defer to Phase 8 if time constrained
6. **Script sharing across clients** - No for MVP, scripts are client-scoped
7. **Niche hierarchies** - No for MVP, flat taxonomy sufficient

---

## Sources

- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RLS Best Practices (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [PostgREST Aggregate Functions](https://supabase.com/blog/postgrest-aggregate-functions)
- [shadcn/ui Combobox Component](https://ui.shadcn.com/docs/components/radix/combobox)
- [Headless UI Combobox](https://headlessui.com/react/combobox)
- [Android Accessibility Touch Target Size](https://support.google.com/accessibility/android/answer/7101858?hl=en)
- [WCAG 2.1 Target Size Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Accessible Touch Target Sizes Cheatsheet](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)

---

**Research Confidence:** HIGH
- Database schema verified against existing Supabase patterns
- Component patterns match established conventions (native dialog, RPC aggregation)
- RLS policies follow documented best practices
- Touch target sizes meet accessibility standards
- Build order respects dependencies and enables incremental testing
