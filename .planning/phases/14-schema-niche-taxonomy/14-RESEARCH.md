# Phase 14: Schema + Niche Taxonomy - Research

**Researched:** 2026-02-15
**Domain:** Database schema implementation for scripts, niches, and lead-niche association
**Confidence:** HIGH

## Summary

Phase 14 implements the foundational database schema for the Cold Calling Scripts feature. This research examines the **current codebase structure** to identify exactly where and how to integrate the niche taxonomy into existing pages and components.

**Milestone-level research already exists** in `.planning/research/` covering:
- Full schema design with RLS policies (ARCHITECTURE.md)
- 18 domain pitfalls mapped (PITFALLS.md)
- Stack decisions: react-hook-form, zod, shadcn Command/Dialog/Textarea (STACK-v1.4.md)

**This phase-specific research focuses on:**
1. Current codebase structure and patterns
2. Exact integration points for niche field
3. Migration naming conventions
4. Type definitions structure

**Primary recommendation:** Follow existing migration pattern (numbered SQL files with descriptive names), add niche_id to Lead type, create NicheComboBox component following shadcn Command + Popover pattern, integrate into Add Lead dialog and lead detail edit mode.

## Standard Stack

All required dependencies are already installed or use existing patterns:

### Core Dependencies (Already Installed)
| Library | Version | Purpose | Location |
|---------|---------|---------|----------|
| Next.js | 14.2.0 | App router framework | crm-dashboard/package.json |
| Supabase client | 2.39.0 | Database queries | crm-dashboard/package.json |
| @radix-ui/react-popover | 1.1.15 | Popover primitive for combo | crm-dashboard/package.json |
| Tailwind CSS | 3.4.0 | Styling | crm-dashboard/package.json |

### New Dependencies Required
| Library | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| @radix-ui/react-command | Latest | Command menu for combo selector | `npx shadcn@latest add command` |
| @radix-ui/react-dialog | Latest | Dialog primitive (already may exist via shadcn) | `npx shadcn@latest add dialog` |

**Installation:**
```bash
cd crm-dashboard
npx shadcn@latest add command
# Dialog may already exist from other shadcn components
```

## Architecture Patterns

### Existing Migration Structure

**Location:** `crm-dashboard/supabase/migrations/`

**Naming convention observed:**
```
003_toast_items_payments.sql
004_revenue_aggregation.sql
005_revenue_exclude_invoices.sql
05_shrike_consolidation.sql        # Note: inconsistent zero-padding
06_cold_calling_client.sql
```

**Pattern for Phase 14:**
- Next number is 07 or 007 (recommendation: use 07 to match 06 pattern)
- Descriptive name: `07_scripts_niches_outcomes.sql`
- Structure follows existing pattern from 06_cold_calling_client.sql:
  - Header comment block with purpose, tables affected, rollback strategy
  - BEGIN transaction
  - Step-by-step changes with comments
  - COMMIT

**Key observations from existing migrations:**
- Extensive inline documentation (purpose, affected tables, rollback)
- Use `gen_random_uuid()` for UUID defaults
- CHECK constraints for validation (e.g., social_media_presence range)
- Indexes created immediately after table creation
- RLS enabled with separate policies for SELECT/INSERT/UPDATE/DELETE

### Existing Type Definition Structure

**Location:** `crm-dashboard/types/lead.ts`

**Current Lead interface:**
```typescript
export interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  sms_consent: boolean
  sms_consent_at: string | null
  preferred_contact: 'email' | 'phone' | 'sms'
  ip_address: string | null
  user_agent: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  landing_page_url: string | null
  referrer: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'unqualified'
  notes: string | null
  has_website: boolean | null
  social_media_presence: number | null  // 1-5 scale
  created_at: string
  updated_at: string
}
```

**Pattern for niche addition:**
- Add `niche_id: string | null` to Lead interface
- Create new `types/niche.ts` file:
```typescript
export interface Niche {
  id: string
  name: string
  created_at: string
}
```

- If joining niche data in queries, extend Lead with optional niche object:
```typescript
export interface LeadWithNiche extends Lead {
  niche?: Niche | null
}
```

### Existing Query Patterns

**Pattern 1: Simple select with client filter (from leads/page.tsx)**
```typescript
let query = supabase
  .from('leads')
  .select('*')
  .order('created_at', { ascending: false })

// Admin filtering by selected client
if (isAdmin && currentClientId) {
  query = query.eq('client_id', currentClientId)
}

if (statusFilter) {
  query = query.eq('status', statusFilter)
}
```

**Pattern for niche filter:**
```typescript
const [nicheFilter, setNicheFilter] = useState<string>('')

// In query building:
if (nicheFilter) {
  query = query.eq('niche_id', nicheFilter)
}
```

**Pattern 2: Helper function for client filtering (from analytics/page.tsx)**
```typescript
// Helper to add client filter
const addClientFilter = <T,>(query: T): T => {
  if (isAdmin && currentClientId) {
    return (query as any).eq('client_id', currentClientId)
  }
  return query
}

// Usage:
let statusQuery = supabase.from('leads').select('status')
statusQuery = addClientFilter(statusQuery)
```

**NO joins found in current codebase** - all queries use simple selects. For niche display, two options:
1. **Separate query:** Fetch niches list separately, join in JavaScript
2. **Supabase join syntax:** Use `select('*, niche:niches(name)')` for single query

Recommendation: Use option 2 for table display (reduces queries), but only when displaying niche name (not for simple filtering).

### Existing Form Patterns

**Pattern 1: Native HTML Dialog (from leads/page.tsx)**
```typescript
const dialogRef = useRef<HTMLDialogElement>(null)

// Open dialog
<button onClick={() => dialogRef.current?.showModal()}>
  Add Lead
</button>

// Dialog structure
<dialog
  ref={dialogRef}
  className="rounded-lg shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
  onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
>
  <form onSubmit={handleAddLead} className="p-6">
    {/* Form fields */}
  </form>
</dialog>
```

**Pattern for adding niche field to Add Lead dialog:**
- Add NicheComboBox component between existing fields
- Pass selected niche ID to form submission
- FormData handling already established:
```typescript
const formData = new FormData(form)
const hasWebsite = formData.get('has_website') === 'on'
```

**Pattern 2: Inline Edit Mode (from leads/[id]/page.tsx)**
```typescript
const [isEditing, setIsEditing] = useState(false)
const [editForm, setEditForm] = useState({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  preferred_contact: 'email' as 'email' | 'phone' | 'sms',
  sms_consent: false,
  has_website: null as boolean | null,
  social_media_presence: null as number | null,
})

const startEdit = () => {
  if (!lead) return
  setEditForm({
    first_name: lead.first_name,
    // ... populate all fields
  })
  setIsEditing(true)
}

const saveEdit = async () => {
  // Calculate changed fields for audit log
  const changedFields: Record<string, any> = {}
  if (editForm.first_name !== lead.first_name) changedFields.first_name = editForm.first_name

  const { error } = await supabase
    .from('leads')
    .update({
      first_name: editForm.first_name,
      // ... all fields
    })
    .eq('id', id)
}
```

**Pattern for adding niche to edit mode:**
- Add `niche_id: string | null` to editForm state
- Populate from `lead.niche_id` in startEdit
- Include in update payload
- Add to changedFields tracking

### Existing Filter Bar Pattern

**From leads/page.tsx:**
```typescript
<div className="bg-white rounded-lg shadow p-4 mb-6">
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <input type="text" placeholder="Search..." />

    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
      <option value="">All Statuses</option>
      <option value="new">New</option>
      {/* ... */}
    </select>

    <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
      <option value="">All Campaigns</option>
      {campaigns.map((campaign) => (
        <option key={campaign} value={campaign}>{campaign}</option>
      ))}
    </select>

    <button onClick={() => { /* clear all */ }}>Clear Filters</button>
  </div>
</div>
```

**Pattern for niche filter:**
- Fetch niches list: `const [niches, setNiches] = useState<Niche[]>([])`
- Add select dropdown in grid (change to `md:grid-cols-5` for 5 filters)
- Populate from `supabase.from('niches').select('*').order('name')`
- Include in Clear Filters reset

### Existing Table Column Pattern

**From leads/page.tsx table:**
```typescript
<thead className="bg-gray-50">
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Name
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Contact
    </th>
    {/* ... */}
  </tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
  {leads.map((lead) => (
    <tr key={lead.id} className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <Link href={`/leads/${lead.id}`}>
          {lead.first_name} {lead.last_name}
        </Link>
      </td>
      {/* ... */}
    </tr>
  ))}
</tbody>
```

**Pattern for niche column:**
- Add `<th>` for "Niche" header
- Add `<td>` displaying niche name (requires join or lookup)
- If using join: `{lead.niche?.name || '-'}`
- If using lookup: Create `nichesMap` from separate query, display `nichesMap[lead.niche_id]?.name || '-'`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable dropdown with "create new" | Custom input + datalist + create button | shadcn Command + Popover (Combobox pattern) | Accessibility (ARIA, keyboard nav), fuzzy search, focus management |
| Lowercase normalization | Client-side `.toLowerCase()` before insert | PostgreSQL CHECK constraint + trigger | Database enforces consistency, handles direct SQL inserts |
| Duplicate prevention | Client-side niche list check | PostgreSQL UNIQUE constraint | Race conditions in concurrent inserts, handles all entry points |
| Form validation | Manual field checks in onSubmit | react-hook-form + zod (future phase) | Type safety, reusable schemas, better error UX |

**Key insight:** Phase 14 is schema-only, so focus is on database-level constraints. The CHECK constraint for lowercase normalization is critical:
```sql
CONSTRAINT niche_name_lowercase CHECK (name = lower(name))
```
This prevents case-variant duplicates ("Restaurant" vs "restaurant") at the database level.

## Common Pitfalls

### Pitfall 1: Case-Insensitive Uniqueness Without Normalization
**What goes wrong:** User creates "Restaurant", later tries to create "restaurant" (lowercase). UNIQUE constraint on `name` allows both because they're different strings. Now you have duplicate niches.

**How to avoid:**
- Add CHECK constraint: `CONSTRAINT niche_name_lowercase CHECK (name = lower(name))`
- Client-side: Always `.toLowerCase().trim()` before insert
- UNIQUE constraint on normalized `name` column

**Warning signs:**
- Migration has UNIQUE but no CHECK for lowercase
- Client code doesn't lowercase input before submission

**Phase 14 addresses:** YES - migration must include both constraints

---

### Pitfall 2: Missing niche_id Column Breaks Existing Queries
**What goes wrong:** Add `niche_id` column to leads table. Existing queries use `SELECT *`. TypeScript Lead interface expects `niche_id`. But old leads have `niche_id = NULL`. Code assumes non-null types crash.

**How to avoid:**
- Define `niche_id UUID NULL REFERENCES niches(id) ON DELETE SET NULL`
- Update Lead interface: `niche_id: string | null` (explicitly nullable)
- Test existing pages still load after migration (no TypeScript errors)

**Warning signs:**
- Migration adds column as NOT NULL without DEFAULT
- Type definition doesn't mark field as nullable
- No test of existing lead list page after migration

**Phase 14 addresses:** YES - migration defines nullable column, types updated

---

### Pitfall 3: Orphaned Niche References After Niche Deletion
**What goes wrong:** User deletes niche "Restaurant". 50 leads have `niche_id` pointing to deleted niche. Queries break or show broken foreign key references.

**How to avoid:**
- Foreign key: `ON DELETE SET NULL` (recommended - preserves leads, clears niche)
- OR: `ON DELETE RESTRICT` (prevents deletion if leads reference it)
- NOT: `ON DELETE CASCADE` (would delete leads - catastrophic)

**Warning signs:**
- Migration creates foreign key without ON DELETE clause
- No consideration of "what happens when niche is deleted"

**Phase 14 addresses:** YES - ARCHITECTURE.md specifies `ON DELETE SET NULL`

---

### Pitfall 4: RLS Policies Missing for New Tables
**What goes wrong:** Create `niches` table, enable RLS, deploy. UI shows "No niches available" even though database has niches. Queries return empty results.

**How to avoid:**
- For EVERY table, define SELECT policy FIRST
- Niches are global (not client-scoped), so: `CREATE POLICY niches_select ON niches FOR SELECT TO authenticated USING (true);`
- Test with anon key (not service_role) to catch missing policies

**Warning signs:**
- Migration enables RLS but only defines INSERT/UPDATE/DELETE policies
- SELECT queries return `{ data: [], error: null }` but SQL editor shows rows

**Phase 14 addresses:** YES - ARCHITECTURE.md includes all RLS policies

---

### Pitfall 5: Migration Number Conflicts
**What goes wrong:** Two developers create migrations `07_feature_a.sql` and `07_feature_b.sql`. Supabase applies them in filesystem order, but git merge creates conflict.

**How to avoid:**
- Check latest migration number BEFORE creating new migration
- Use timestamp-based naming if multiple developers (e.g., `20260215_scripts.sql`)
- For this project: Single developer, check last migration is `06_cold_calling_client.sql`, use `07_scripts_niches_outcomes.sql`

**Warning signs:**
- Migration numbering is inconsistent (some zero-padded, some not)
- No check of existing migrations before creating new one

**Phase 14 addresses:** YES - research documents current state (last is 06), use 07

---

### Pitfall 6: Index Missing for niche_id Foreign Key
**What goes wrong:** Leads table has `niche_id` foreign key. Query for "all leads in niche X" requires full table scan because no index exists. With 10,000+ leads, page load times spike.

**How to avoid:**
- Create index on foreign key column: `CREATE INDEX idx_leads_niche_id ON leads(niche_id);`
- Supabase DOES NOT auto-create indexes for foreign keys (unlike some databases)

**Warning signs:**
- Migration adds foreign key but no index
- EXPLAIN ANALYZE shows Seq Scan on leads table for niche filter queries

**Phase 14 addresses:** YES - migration must include index creation

---

### Pitfall 7: Niche Name Truncation in UI Without Database Constraint
**What goes wrong:** User pastes 5000-character string into niche name field. Database accepts it (TEXT has no limit). Table display breaks layout. Combo selector becomes unusable.

**How to avoid:**
- Add CHECK constraint: `CONSTRAINT niche_name_length CHECK (char_length(name) <= 100)`
- Client validation: `maxLength={100}` on input
- Both layers protect against different entry points

**Warning signs:**
- Migration defines name as TEXT with no length constraint
- No client-side maxLength validation

**Phase 14 addresses:** Partial - ARCHITECTURE.md includes emptiness check, should add length limit

---

## Code Examples

### Migration Structure (Following 06_cold_calling_client.sql Pattern)

```sql
-- =============================================================================
-- Migration: Scripts, Niches, and Outcomes Schema
-- =============================================================================
-- Purpose: Create tables for call scripts, business niche taxonomy, and
--          script-lead outcome tracking. Extend leads table with niche_id.
--
-- Tables created: scripts, niches, script_lead_outcomes
-- Tables modified: leads (add niche_id column)
--
-- Changes:
--   1. niches: Global niche taxonomy with lowercase-normalized unique names
--   2. scripts: Client-scoped call scripts with soft delete (is_active)
--   3. script_lead_outcomes: Per-lead outcomes for script usage tracking
--   4. leads: Add niche_id foreign key for lead categorization
--
-- Rollback strategy:
--   1. ALTER TABLE leads DROP COLUMN niche_id;
--   2. DROP TABLE script_lead_outcomes;
--   3. DROP TABLE scripts;
--   4. DROP TABLE niches;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Create niches table (global taxonomy)
-- ---------------------------------------------------------------------------
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT niche_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT niche_name_lowercase CHECK (name = lower(name)),
  CONSTRAINT niche_name_length CHECK (char_length(name) <= 100)
);

CREATE INDEX idx_niches_name ON niches(name);

-- RLS for niches (global, all authenticated users can read/create)
ALTER TABLE niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY niches_select ON niches FOR SELECT
  TO authenticated USING (true);

CREATE POLICY niches_insert ON niches FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY niches_delete ON niches FOR DELETE
  TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Step 2: Add niche_id to leads table
-- ---------------------------------------------------------------------------
ALTER TABLE leads
ADD COLUMN niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_niche_id ON leads(niche_id);

COMMIT;
```

### NicheComboBox Component (shadcn Command + Popover Pattern)

```typescript
// components/NicheComboBox.tsx
'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'

interface Niche {
  id: string
  name: string
}

interface NicheComboBoxProps {
  value: string | null
  onChange: (nicheId: string | null) => void
}

export function NicheComboBox({ value, onChange }: NicheComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [niches, setNiches] = useState<Niche[]>([])
  const [searchValue, setSearchValue] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchNiches()
  }, [])

  const fetchNiches = async () => {
    const { data } = await supabase
      .from('niches')
      .select('*')
      .order('name')

    if (data) setNiches(data)
  }

  const handleCreateNiche = async () => {
    if (!searchValue.trim()) return

    const normalizedName = searchValue.toLowerCase().trim()

    // Try to insert (ON CONFLICT DO NOTHING handles duplicates)
    const { data, error } = await supabase
      .from('niches')
      .insert({ name: normalizedName })
      .select()
      .single()

    if (!error && data) {
      setNiches([...niches, data])
      onChange(data.id)
      setSearchValue('')
      setOpen(false)
    } else if (error?.code === '23505') {
      // Unique constraint violation - niche already exists
      const existing = niches.find(n => n.name === normalizedName)
      if (existing) {
        onChange(existing.id)
        setSearchValue('')
        setOpen(false)
      }
    }
  }

  const selectedNiche = niches.find(n => n.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedNiche ? selectedNiche.name : "Select niche..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search or create niche..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandEmpty>
            <button
              onClick={handleCreateNiche}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100"
            >
              Create "{searchValue}"
            </button>
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  !value ? "opacity-100" : "opacity-0"
                )}
              />
              (None)
            </CommandItem>
            {niches.map((niche) => (
              <CommandItem
                key={niche.id}
                onSelect={() => {
                  onChange(niche.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === niche.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {niche.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

### Add Lead Dialog Integration

```typescript
// In leads/page.tsx - Add Lead dialog
const [selectedNiche, setSelectedNiche] = useState<string | null>(null)

const handleAddLead = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  // ... existing code

  const { error } = await supabase.from('leads').insert({
    client_id: currentClientId,
    first_name: formData.get('first_name') as string || '',
    last_name: formData.get('last_name') as string || '',
    email: formData.get('email') as string || '',
    phone: (formData.get('phone') as string) || null,
    niche_id: selectedNiche, // NEW: Include niche
    // ... rest of fields
  })

  if (!error) {
    form.reset()
    setSelectedNiche(null) // NEW: Reset niche selection
    dialogRef.current?.close()
    fetchLeads()
  }
}

// In dialog JSX, add between existing fields:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Business Niche
  </label>
  <NicheComboBox
    value={selectedNiche}
    onChange={setSelectedNiche}
  />
</div>
```

### Lead Detail Edit Mode Integration

```typescript
// In leads/[id]/page.tsx
const [editForm, setEditForm] = useState({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  preferred_contact: 'email' as 'email' | 'phone' | 'sms',
  sms_consent: false,
  has_website: null as boolean | null,
  social_media_presence: null as number | null,
  niche_id: null as string | null, // NEW: Add niche to edit form
})

const startEdit = () => {
  if (!lead) return
  setEditForm({
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone || '',
    preferred_contact: lead.preferred_contact,
    sms_consent: lead.sms_consent,
    has_website: lead.has_website,
    social_media_presence: lead.social_media_presence,
    niche_id: lead.niche_id, // NEW: Populate niche
  })
  setIsEditing(true)
}

const saveEdit = async () => {
  if (!lead) return
  setSaving(true)

  // Calculate changed fields
  const changedFields: Record<string, any> = {}
  if (editForm.first_name !== lead.first_name) changedFields.first_name = editForm.first_name
  // ... other fields
  if (editForm.niche_id !== lead.niche_id) changedFields.niche_id = editForm.niche_id // NEW

  const { error } = await supabase
    .from('leads')
    .update({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      email: editForm.email,
      phone: editForm.phone || null,
      preferred_contact: editForm.preferred_contact,
      sms_consent: editForm.sms_consent,
      has_website: editForm.has_website,
      social_media_presence: editForm.social_media_presence,
      niche_id: editForm.niche_id, // NEW: Include in update
    })
    .eq('id', id)

  // ... rest of save logic
}

// In edit mode JSX, add niche field:
<div>
  <label className="block text-sm font-medium text-gray-500 mb-1">
    Business Niche
  </label>
  <NicheComboBox
    value={editForm.niche_id}
    onChange={(nicheId) => setEditForm({ ...editForm, niche_id: nicheId })}
  />
</div>
```

### Leads Table with Niche Column (Join Pattern)

```typescript
// In leads/page.tsx
const fetchLeads = useCallback(async () => {
  let query = supabase
    .from('leads')
    .select('*, niche:niches(name)') // NEW: Join niche data
    .order('created_at', { ascending: false })

  // ... existing filters

  const { data, error } = await query

  if (error) {
    console.error('Error fetching leads:', error)
  } else {
    setLeads(data || [])
  }
  setLoading(false)
}, [supabase, statusFilter, campaignFilter, search, isAdmin, currentClientId])

// In table header, add niche column:
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Niche
</th>

// In table body, display niche:
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
  {lead.niche?.name || '-'}
</td>
```

### Niche Filter Dropdown

```typescript
// In leads/page.tsx
const [nicheFilter, setNicheFilter] = useState<string>('')
const [niches, setNiches] = useState<Niche[]>([])

const fetchNiches = useCallback(async () => {
  const { data } = await supabase
    .from('niches')
    .select('*')
    .order('name')

  if (data) {
    setNiches(data)
  }
}, [supabase])

useEffect(() => {
  fetchLeads()
  fetchCampaigns()
  fetchNiches() // NEW: Fetch niches for filter
}, [fetchLeads, fetchCampaigns, fetchNiches])

// In fetchLeads query builder:
if (nicheFilter) {
  query = query.eq('niche_id', nicheFilter)
}

// In filter bar, add niche dropdown (change grid to md:grid-cols-5):
<select
  value={nicheFilter}
  onChange={(e) => setNicheFilter(e.target.value)}
  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">All Niches</option>
  {niches.map((niche) => (
    <option key={niche.id} value={niche.id}>
      {niche.name}
    </option>
  ))}
</select>

// In Clear Filters button:
onClick={() => {
  setSearch('')
  setStatusFilter('')
  setCampaignFilter('')
  setNicheFilter('') // NEW: Clear niche filter
}}
```

## State of the Art

| Approach | Phase 14 Implementation | Notes |
|----------|-------------------------|-------|
| Niche storage | Separate `niches` table with UNIQUE constraint | Old approach: ENUM or hardcoded list. New: User-managed taxonomy |
| Case normalization | CHECK constraint + lowercase storage | Prevents "Restaurant" vs "restaurant" duplicates |
| Combobox pattern | shadcn Command + Popover | Modern accessible pattern replacing custom autocomplete |
| Foreign key handling | ON DELETE SET NULL | Preserves leads when niche deleted, better than RESTRICT or CASCADE |
| Type safety | Nullable `niche_id: string \| null` | Explicit nullability prevents runtime errors |

**Deprecated/outdated:**
- Custom autocomplete with datalist element - Poor mobile support, limited styling
- Storing niches as comma-separated string in leads table - Cannot query/filter efficiently
- No normalization - Leads to duplicate categories ("Web Design" vs "web design")

## Open Questions

1. **Niche deletion UI**
   - What we know: Database allows deletion if no leads reference it (ON DELETE SET NULL)
   - What's unclear: Should UI prevent deletion of niches with leads? Or allow and show warning?
   - Recommendation: Allow deletion, leads just lose niche assignment (set to null). Simple and matches database behavior.

2. **Niche character limit**
   - What we know: ARCHITECTURE.md has emptiness check, no length constraint
   - What's unclear: What's reasonable max length? 50? 100? 255?
   - Recommendation: 100 characters (matches industry name fields, prevents UI layout issues)

3. **Global vs client-scoped niches**
   - What we know: ARCHITECTURE.md specifies global niches (no client_id)
   - What's unclear: Will this cause confusion if multiple clients use same CRM instance?
   - Recommendation: Keep global for MVP. If collision occurs, add client_id in future migration.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: crm-dashboard/app/(dashboard)/leads/page.tsx (current leads list implementation)
- Codebase analysis: crm-dashboard/app/(dashboard)/leads/[id]/page.tsx (inline edit pattern)
- Codebase analysis: crm-dashboard/supabase/migrations/06_cold_calling_client.sql (migration pattern)
- Codebase analysis: crm-dashboard/types/lead.ts (type definition structure)
- Existing research: .planning/research/ARCHITECTURE.md (schema design with RLS)
- Existing research: .planning/research/PITFALLS.md (domain pitfalls)
- Existing research: .planning/research/STACK-v1.4.md (stack decisions)

### Secondary (MEDIUM confidence)
- Package.json analysis: Confirmed installed dependencies (Next.js 14.2.0, Supabase 2.39.0, Radix UI Popover 1.1.15)
- Git history: Last migration is 06_cold_calling_client.sql (2026-02-15)

## Metadata

**Confidence breakdown:**
- Migration structure: HIGH - Observed pattern from 5 existing migrations
- Type definitions: HIGH - Existing Lead interface provides exact pattern
- Integration points: HIGH - Current form and table implementations are clear
- Component patterns: MEDIUM - shadcn Command not yet in codebase, following official docs pattern

**Research date:** 2026-02-15
**Valid until:** 30 days (stable codebase patterns, unlikely to change)
**Codebase version:** Last commit d205e24 (2026-02-15)

**Implementation-specific findings:**
- Zero-padding inconsistency in migrations (05 vs 005) - use 07 to match recent pattern
- No existing joins in queries - simplest approach is separate niche fetch + JS lookup for table display
- Native HTML dialog pattern established for Add Lead - can reuse or upgrade to shadcn Dialog
- Inline edit pattern uses useState for form state, not react-hook-form (save for later phases)
- Filter bar uses simple select dropdowns, not fancy multi-select components
