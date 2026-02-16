# Phase 16: Outcome Tracking - Research

**Researched:** 2026-02-16
**Domain:** Outcome tracking for call scripts using upsert patterns, aggregation, and mobile-optimized UX
**Confidence:** HIGH

## Summary

Phase 16 implements outcome tracking for call scripts: users can record per-lead call outcomes (success/fail) tied to specific scripts, with large phone-friendly buttons and optional notes. The research examines Supabase upsert patterns using UNIQUE constraints, aggregation strategies (RPC vs client-side vs PostgREST aggregates), mobile outcome recording UX, lead selection patterns, and integration with the existing ScriptManager dialog state machine.

**Context from prior phases:**
- Phase 14 created `script_lead_outcomes` table with `UNIQUE(script_id, lead_id)` constraint enabling upsert pattern
- Phase 15 built ScriptManager with dialog state machine (`'closed' | 'add' | 'edit' | 'view'`)
- Schema includes: `id`, `script_id`, `lead_id`, `outcome` ('success' | 'fail'), `notes`, `created_at`, `created_by`
- RLS policies scope outcomes through scripts -> client_id using `private.get_user_client_id()`
- Existing codebase uses RPC functions for aggregation (e.g., `get_revenue_by_period` for revenue charts)

**Key architectural decisions:**
1. **Upsert pattern**: Use `.upsert()` with `onConflict: 'script_id,lead_id'` for update-or-insert behavior
2. **Aggregation strategy**: Use PostgreSQL RPC function (matching existing `get_revenue_by_period` pattern) for script counter aggregation
3. **Lead selection**: Use shadcn Combobox (matching existing NicheComboBox pattern) with search
4. **Mobile UX**: 48x48px minimum touch targets for success/fail buttons (matching Android Material standard)
5. **Dialog flow**: Extend existing state machine to `'closed' | 'add' | 'edit' | 'view' | 'record-outcome'`

**Primary recommendation:** Add a "Record Outcome" dialog mode to ScriptManager, use Supabase upsert for outcome persistence, create an RPC function for aggregated counters (success_count, fail_count, win_rate), and display counters directly on ScriptCard.

## Standard Stack

The established libraries/tools for outcome tracking in Next.js + Supabase context:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JavaScript Client | latest | `.upsert()` with `onConflict` for outcome update-or-insert | Native PostgreSQL ON CONFLICT support, handles unique constraint violations, returns updated rows. Already used throughout codebase. |
| PostgreSQL RPC Functions | n/a | Aggregate script outcome counters (success/fail counts, win rate) | Established pattern in codebase (get_revenue_by_period). Avoids N+1 queries, indexes optimize aggregation, SECURITY DEFINER enforces RLS. |
| shadcn Combobox | ^1.1.5 | Searchable lead selector with keyboard navigation | Matches existing NicheComboBox pattern from Phase 14. Touch-friendly, accessible, debounced search. |
| React Hook Form Controller | ^7.71.0 | Controlled Combobox integration for lead selection validation | Required for controlled components (Combobox). Already used in AddEditScriptDialog. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react icons | latest | Check, X, Phone icons for outcome buttons | Already used in ScriptCard (Pencil, EyeOff, Eye). Consistent icon system. |
| Tailwind responsive classes | n/a | Mobile-first button sizing (`min-h-[48px]`, `md:min-h-[44px]`) | Existing pattern throughout codebase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL RPC | PostgREST aggregate functions | PostgREST aggregates disabled by default, require manual enablement (`pgrst.db_aggregates_enabled`), may cause DoS risk without query cost limits. RPC is safer and matches existing pattern. |
| PostgreSQL RPC | Client-side aggregation | Client-side counting requires fetching all outcomes then aggregating in JavaScript (N+1 problem). Database aggregation is faster and leverages indexes. |
| Combobox | Native `<select>` dropdown | Native select can't search, poor mobile UX with long lists (10+ leads). Combobox provides instant filtering. |
| Combobox | Full lead table with radio buttons | Works but wastes vertical space on mobile. Combobox is more compact and familiar pattern from NicheComboBox. |
| Separate outcome dialog | Inline outcome buttons on lead rows | Inline recording loses script context (which script was used?). Dialog keeps script in view during outcome recording. |

**Installation:**
```bash
# No new dependencies required
# - Supabase client already installed
# - shadcn Combobox already installed (Phase 14)
# - React Hook Form + Controller already installed (Phase 15)
```

## Architecture Patterns

### Recommended Component Structure

```
crm-dashboard/
├── components/
│   ├── ScriptManager.tsx              # Extended with 'record-outcome' dialog mode
│   ├── ScriptCard.tsx                 # Enhanced with success/fail/rate counters
│   ├── RecordOutcomeDialog.tsx        # NEW: Outcome recording form
│   └── LeadComboBox.tsx               # NEW: Searchable lead selector (optional - can inline)
├── supabase/migrations/
│   └── 08_script_outcome_aggregation.sql  # NEW: RPC function for counter aggregation
└── types/
    └── script.ts                      # Add ScriptWithOutcomes type
```

### Pattern 1: Supabase Upsert with Unique Constraint

**What:** Use `.upsert()` to insert new outcome or update existing outcome for script+lead pair.

**When to use:** Any table with UNIQUE constraint where you want update-or-insert behavior without checking existence first.

**Example:**

```typescript
// Source: Supabase JavaScript upsert documentation
// https://supabase.com/docs/reference/javascript/upsert

const { data, error } = await supabase
  .from('script_lead_outcomes')
  .upsert({
    script_id: selectedScript.id,
    lead_id: selectedLead.id,
    outcome: 'success', // or 'fail'
    notes: formData.notes,
    created_by: userId,
  }, {
    onConflict: 'script_id,lead_id', // Match UNIQUE(script_id, lead_id) constraint
  })
  .select()
  .single()

// How it works:
// 1. If no row with this (script_id, lead_id) exists: INSERT new row
// 2. If row exists: UPDATE the existing row (outcome, notes, created_by)
// 3. UNIQUE constraint enforces one outcome per script-lead pair
// 4. No race conditions - database handles conflict atomically
```

**Critical details:**
- **Must specify onConflict columns exactly matching UNIQUE constraint name or columns**
- Primary keys not required in data if using multi-column unique constraint
- Returns updated row with `.select()` - use `.single()` to get object instead of array
- Error "No unique or exclusion constraint matching ON CONFLICT" means typo in onConflict value

### Pattern 2: PostgreSQL RPC for Aggregated Counters

**What:** Database function that joins scripts + outcomes and returns success_count, fail_count, win_rate per script.

**When to use:** Displaying aggregated metrics on multiple items (script cards) - avoids N+1 queries.

**Example:**

```sql
-- Source: Existing get_revenue_by_period pattern from migration 005
-- C:\Users\steph\OneDrive\Desktop\claude\Nessus\crm-dashboard\supabase\migrations\005_revenue_exclude_invoices.sql

CREATE OR REPLACE FUNCTION get_script_outcome_stats(
  p_client_id UUID
)
RETURNS TABLE (
  script_id UUID,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as script_id,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT as success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT as fail_count,
    COALESCE(COUNT(*), 0)::BIGINT as total_count,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100,
          1
        )
      ELSE 0
    END as win_rate
  FROM scripts s
  LEFT JOIN script_lead_outcomes o ON o.script_id = s.id
  WHERE s.client_id = p_client_id
    AND s.is_active = true
  GROUP BY s.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_script_outcome_stats(UUID) IS
'Aggregates outcome counts and win rate per script for a client.
Returns 0 counts for scripts with no outcomes (LEFT JOIN).
Win rate = (success_count / total_count) * 100, rounded to 1 decimal place.';
```

**Client usage:**

```typescript
// Fetch scripts WITH outcome stats in a single query
const { data: scriptStats, error } = await supabase
  .rpc('get_script_outcome_stats', { p_client_id: clientId })

// Returns: [
//   { script_id: 'uuid1', success_count: 5, fail_count: 2, total_count: 7, win_rate: 71.4 },
//   { script_id: 'uuid2', success_count: 0, fail_count: 0, total_count: 0, win_rate: 0 },
// ]

// Join with scripts in React:
const scriptsWithStats = scripts.map(script => ({
  ...script,
  stats: scriptStats?.find(s => s.script_id === script.id) || {
    success_count: 0,
    fail_count: 0,
    total_count: 0,
    win_rate: 0,
  }
}))
```

**Why RPC over PostgREST aggregates:**
- PostgREST aggregates disabled by default (security risk)
- Enabling requires `ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'`
- RPC function uses SECURITY DEFINER - respects RLS, safer
- Matches existing codebase pattern (get_revenue_by_period)

**Why RPC over client-side counting:**
- Database aggregation leverages indexes (idx_slo_script_id)
- Single round-trip vs N queries (one per script)
- Consistent with revenue charts pattern

### Pattern 3: Mobile-Optimized Outcome Buttons

**What:** Large touch-friendly buttons for success/fail with clear visual distinction.

**When to use:** Primary actions on mobile (especially phone calls where user may be holding device).

**Example:**

```tsx
// Source: Android Material Design 48x48dp + Apple HIG 44x44pt standards
// https://uxmovement.com/mobile/optimal-size-and-spacing-for-mobile-buttons/
// https://www.designmonks.co/blog/perfect-mobile-button-size

<div className="flex flex-col gap-4 md:flex-row md:gap-3">
  <button
    type="button"
    onClick={() => handleOutcome('success')}
    disabled={isSubmitting}
    className="
      min-h-[48px] min-w-[48px]          // Android Material: 48x48 dp
      flex-1                              // Equal width on mobile
      flex items-center justify-center gap-2
      bg-green-600 hover:bg-green-700
      text-white font-semibold text-lg
      rounded-lg
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors
    "
  >
    <Check className="h-6 w-6" />
    Success
  </button>

  <button
    type="button"
    onClick={() => handleOutcome('fail')}
    disabled={isSubmitting}
    className="
      min-h-[48px] min-w-[48px]
      flex-1
      flex items-center justify-center gap-2
      bg-red-600 hover:bg-red-700
      text-white font-semibold text-lg
      rounded-lg
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors
    "
  >
    <X className="h-6 w-6" />
    Failed
  </button>
</div>
```

**Mobile UX guidelines:**
- **Minimum size**: 48x48px (Android Material), 44x44px (Apple HIG) - use 48x48 for universal compatibility
- **Spacing**: 12-48px between buttons to prevent accidental touches
- **Stacking**: Vertical on mobile (`flex-col`), horizontal on desktop (`md:flex-row`)
- **Visual feedback**: Disabled state during submission prevents double-tap
- **Icons + text**: Icons provide visual cue, text clarifies action
- **Color coding**: Green (success) and red (fail) are universal conventions

### Pattern 4: Combobox for Lead Selection

**What:** Searchable dropdown for selecting a lead from potentially 100+ leads.

**When to use:** Selecting from large lists where scrolling through all options is impractical.

**Example:**

```tsx
// Source: shadcn Combobox with React Hook Form Controller
// https://ui.shadcn.com/docs/components/radix/combobox
// https://react-hook-form.com/api/usecontroller/controller/

import { Controller } from 'react-hook-form'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

<Controller
  name="lead_id"
  control={form.control}
  rules={{ required: 'Please select a lead' }}
  render={({ field }) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-left min-h-[48px]"
        >
          {field.value
            ? leads.find(l => l.id === field.value)?.first_name + ' ' + leads.find(l => l.id === field.value)?.last_name
            : 'Select lead...'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search leads..." />
          <CommandEmpty>No lead found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto">
            {leads.map((lead) => (
              <CommandItem
                key={lead.id}
                value={`${lead.first_name} ${lead.last_name} ${lead.email}`}
                onSelect={() => field.onChange(lead.id)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </span>
                  <span className="text-sm text-gray-500">{lead.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )}
/>
```

**Key features:**
- **Instant search**: CommandInput filters as user types (client-side filtering)
- **Controller**: Required for React Hook Form validation with controlled Combobox
- **Keyboard navigation**: Arrow keys, Enter to select, Escape to close
- **Touch-friendly**: 48px minimum height on trigger button
- **Multi-line items**: Show lead name + email for disambiguation
- **Empty state**: CommandEmpty handles "no results" case

**Mobile considerations:**
- Popover adjusts position to avoid keyboard overlap
- Max height on CommandGroup prevents dialog stretching off-screen
- Debounce not needed for client-side filtering (instant)
- Test on real devices - virtual keyboard impacts UX

### Pattern 5: Dialog State Machine Extension

**What:** Extend existing ScriptManager dialogMode to include outcome recording without nested dialogs.

**When to use:** Adding new dialog flows to existing component with dialog state machine.

**Example:**

```typescript
// Source: Existing ScriptManager pattern from Phase 15
// C:\Users\steph\OneDrive\Desktop\claude\Nessus\crm-dashboard\components\ScriptManager.tsx

type DialogMode = 'closed' | 'add' | 'edit' | 'view' | 'record-outcome'  // EXTENDED

export function ScriptManager({ clientId }: ScriptManagerProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed')
  const [selectedScript, setSelectedScript] = useState<Script | undefined>()

  const handleRecordOutcome = (script: Script) => {
    setDialogMode('record-outcome')
    setSelectedScript(script)
  }

  return (
    <div>
      {/* Scripts grid */}
      {scripts.map((script) => (
        <ScriptCard
          key={script.id}
          script={script}
          onRecordOutcome={() => handleRecordOutcome(script)}  // NEW
          // ... existing handlers
        />
      ))}

      {/* Add/Edit Dialog */}
      <AddEditScriptDialog
        open={dialogMode === 'add' || dialogMode === 'edit'}
        // ...
      />

      {/* View Dialog */}
      {dialogMode === 'view' && selectedScript && (
        <Dialog open onOpenChange={handleCloseDialog}>
          {/* ... */}
        </Dialog>
      )}

      {/* Record Outcome Dialog - NEW */}
      {dialogMode === 'record-outcome' && selectedScript && (
        <RecordOutcomeDialog
          script={selectedScript}
          clientId={clientId}
          open={true}
          onClose={handleCloseDialog}
          onSaved={() => {
            fetchScripts() // Refresh to show updated counters
            handleCloseDialog()
          }}
        />
      )}
    </div>
  )
}
```

**Why not nested dialogs:**
- Nested dialogs (dialog within dialog) are discouraged UX pattern
- Confusing back button behavior on mobile
- "Infinite modal" pattern (string dialogs together) is better
- State machine ensures only one dialog open at a time
- User flow: Script Card → Record Outcome Dialog (closes, shows script with updated counters)

### Anti-Patterns to Avoid

- **Nested dialogs**: Opening outcome dialog from view dialog creates confusing navigation. Use state machine to switch modes instead.
- **Missing onConflict in upsert**: Without onConflict, upsert acts like insert and fails with duplicate key error. Always specify conflict columns.
- **Client-side aggregation for counters**: Fetching all outcomes and counting in JavaScript is slow (N+1 problem). Use RPC function.
- **Tiny buttons on mobile**: Buttons smaller than 44x44px cause missed taps and user frustration. Follow platform guidelines.
- **Unvalidated lead selection**: Combobox without React Hook Form Controller loses validation. Use Controller for controlled components.
- **Not refreshing counters after outcome save**: Counters become stale if ScriptManager doesn't refetch after outcome recorded. Always refetch.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Update-or-insert logic | Check if row exists with SELECT, then INSERT or UPDATE | Supabase `.upsert()` with `onConflict` | Race conditions between SELECT and INSERT. Database handles atomically with ON CONFLICT. Single query instead of two. |
| Counting outcomes per script | Loop through scripts, count outcomes client-side | PostgreSQL RPC with COUNT() FILTER (WHERE) | Database aggregation leverages indexes (idx_slo_script_id). N+1 problem with client-side counting. Matches existing get_revenue_by_period pattern. |
| Searchable select component | Custom input + filter logic + dropdown positioning | shadcn Combobox | Keyboard navigation, accessibility (ARIA), mobile positioning, empty state handling. Already used in NicheComboBox. |
| Win rate calculation | JavaScript Math.round((success / total) * 100) | PostgreSQL CASE + ROUND in RPC | Handles division by zero at database level. Consistent rounding. Returns 0 for scripts with no outcomes (LEFT JOIN). |
| Lead name formatting | String concatenation in multiple places | Database view or computed property | DRY principle. Format once in RPC or React component, reuse everywhere. |

**Key insight:** Supabase upsert pattern eliminates entire class of race condition bugs. The UNIQUE constraint + onConflict combination ensures exactly-once outcome per script-lead pair without explicit locking.

## Common Pitfalls

### Pitfall 1: Typo in onConflict Parameter

**What goes wrong:** Error "there is no unique or exclusion constraint matching the ON CONFLICT specification" (PostgreSQL error 42P10). Upsert fails, outcome not recorded.

**Why it happens:** The `onConflict` value must exactly match the UNIQUE constraint name or columns. Common mistakes:
- `onConflict: 'script_id_lead_id'` (wrong - constraint is `unique_script_lead`)
- `onConflict: 'script_id, lead_id'` (wrong - space after comma)
- `onConflict: 'lead_id,script_id'` (wrong - order matters)

**How to avoid:**
```typescript
// Check the constraint name in migration file:
// CONSTRAINT unique_script_lead UNIQUE (script_id, lead_id)

// CORRECT: Use comma without spaces
const { data, error } = await supabase
  .from('script_lead_outcomes')
  .upsert({ ... }, { onConflict: 'script_id,lead_id' })

// ALSO CORRECT: Use constraint name
const { data, error } = await supabase
  .from('script_lead_outcomes')
  .upsert({ ... }, { onConflict: 'unique_script_lead' })
```

**Warning signs:**
- Error code 42P10 in console
- Error message mentions "no unique or exclusion constraint"
- First outcome insert works, second fails with duplicate key error

**Source:** [Supabase Discussion #36532](https://github.com/orgs/supabase/discussions/36532)

### Pitfall 2: Not Fetching RPC Results on ScriptManager Mount

**What goes wrong:** Script cards show counters as 0/0/0% even though outcomes exist in database. Counters only update after recording new outcome.

**Why it happens:** Forgot to fetch RPC results (`get_script_outcome_stats`) when ScriptManager mounts. Scripts are fetched, but stats are not joined.

**How to avoid:**
```typescript
useEffect(() => {
  const fetchScriptsAndStats = async () => {
    setLoading(true)

    // Fetch scripts
    const { data: scripts } = await supabase
      .from('scripts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Fetch stats via RPC
    const { data: stats } = await supabase
      .rpc('get_script_outcome_stats', { p_client_id: clientId })

    // Join in React
    const scriptsWithStats = (scripts || []).map(script => ({
      ...script,
      stats: stats?.find(s => s.script_id === script.id) || {
        success_count: 0,
        fail_count: 0,
        total_count: 0,
        win_rate: 0,
      }
    }))

    setScripts(scriptsWithStats)
    setLoading(false)
  }

  fetchScriptsAndStats()
}, [clientId])
```

**Warning signs:**
- Counters always show 0 on initial load
- Counters update after recording outcome
- Database query shows outcomes exist

### Pitfall 3: Combobox Validation Doesn't Trigger

**What goes wrong:** User clicks "Record Outcome" without selecting a lead, no validation error appears, form submits with undefined lead_id.

**Why it happens:** Combobox is a controlled component. Without React Hook Form Controller, the `field.onChange` callback isn't connected to form state. Validation rules on `useForm` don't apply.

**How to avoid:**
```typescript
// WRONG: Direct Combobox without Controller
<Combobox value={selectedLead} onChange={setSelectedLead} />
// No validation possible - onChange isn't connected to RHF

// RIGHT: Wrap in Controller
<Controller
  name="lead_id"
  control={form.control}
  rules={{ required: 'Please select a lead' }}  // Validation rule
  render={({ field }) => (
    <Combobox
      value={field.value}
      onChange={field.onChange}  // Connected to RHF
    />
  )}
/>
{form.formState.errors.lead_id && (
  <p className="text-sm text-red-500">{form.formState.errors.lead_id.message}</p>
)}
```

**Warning signs:**
- Form submits without lead selected
- No red error message appears
- `form.formState.errors.lead_id` is always undefined

**Source:** [React Hook Form Controller docs](https://react-hook-form.com/docs/usecontroller/controller)

### Pitfall 4: Counters Don't Refresh After Outcome Recorded

**What goes wrong:** User records outcome, dialog closes, but script card counters still show old values (e.g., 5/2/71.4% instead of 6/2/75.0%).

**Why it happens:** `onSaved` callback in RecordOutcomeDialog closes dialog but doesn't trigger refetch of scripts + stats. React doesn't know data changed.

**How to avoid:**
```typescript
// In ScriptManager
const handleSaved = async () => {
  await fetchScriptsAndStats()  // Refetch scripts + RPC stats
  setDialogMode('closed')
  setSelectedScript(undefined)
}

// Pass to RecordOutcomeDialog
<RecordOutcomeDialog
  onSaved={handleSaved}  // NOT just () => setDialogMode('closed')
/>

// Alternative: Use Supabase Realtime
// Subscribe to script_lead_outcomes changes and refetch on INSERT/UPDATE
// More complex, overkill for manual outcome recording
```

**Warning signs:**
- Counters update after page refresh but not immediately
- Counters update after switching to another client and back
- Database has correct count but UI doesn't

### Pitfall 5: Mobile Keyboard Covers Outcome Buttons

**What goes wrong:** User opens outcome dialog on mobile, types notes, tries to tap "Success" button, but keyboard covers bottom of dialog. User must dismiss keyboard, scroll, then tap button.

**Why it happens:** Dialog `DialogContent` doesn't account for virtual keyboard height. Bottom buttons get pushed below viewport.

**How to avoid:**
```tsx
// Use sticky positioning for buttons or detect keyboard
<DialogContent className="max-h-[80vh] flex flex-col">
  {/* Scrollable content area */}
  <div className="flex-1 overflow-y-auto p-6">
    <LeadCombobox />
    <Textarea placeholder="Notes..." />
  </div>

  {/* Sticky button row - always visible */}
  <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
    <button className="min-h-[48px] flex-1 bg-green-600">Success</button>
    <button className="min-h-[48px] flex-1 bg-red-600">Fail</button>
  </div>
</DialogContent>

// Or: Put buttons ABOVE textarea (less scrolling needed)
<div className="p-6 space-y-4">
  <LeadCombobox />
  <div className="flex gap-3">
    <button className="min-h-[48px] flex-1 bg-green-600">Success</button>
    <button className="min-h-[48px] flex-1 bg-red-600">Fail</button>
  </div>
  <Textarea placeholder="Optional notes..." />
</div>
```

**Warning signs:**
- Users report "can't reach buttons on phone"
- Multiple taps required (dismiss keyboard, scroll, tap)
- Desktop works fine, mobile is frustrating

**Source:** [Modal UX Best Practices](https://www.eleken.co/blog-posts/modal-ux) - "modal dialogs often appear clunky on mobile devices"

## Code Examples

Verified patterns from official sources:

### Complete RecordOutcomeDialog Component

```typescript
// Source: Combines Supabase upsert pattern + shadcn Combobox + React Hook Form
// https://supabase.com/docs/reference/javascript/upsert
// https://ui.shadcn.com/docs/components/radix/combobox

'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
import type { Script } from '@/types/script'
import type { Lead } from '@/types/lead'

const outcomeSchema = z.object({
  lead_id: z.string().uuid('Please select a lead'),
  notes: z.string().optional(),
})

type OutcomeFormValues = z.infer<typeof outcomeSchema>

interface RecordOutcomeDialogProps {
  script: Script
  clientId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function RecordOutcomeDialog({
  script,
  clientId,
  open,
  onClose,
  onSaved,
}: RecordOutcomeDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const form = useForm<OutcomeFormValues>({
    resolver: zodResolver(outcomeSchema),
    mode: 'onSubmit',
  })

  // Fetch leads on mount
  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)

      setLeads(data || [])
    }
    fetchLeads()
  }, [clientId])

  const handleOutcome = async (outcome: 'success' | 'fail') => {
    const isValid = await form.trigger() // Validate form
    if (!isValid) return

    const { lead_id, notes } = form.getValues()
    setIsSubmitting(true)

    const { error } = await supabase
      .from('script_lead_outcomes')
      .upsert({
        script_id: script.id,
        lead_id: lead_id,
        outcome: outcome,
        notes: notes || null,
      }, {
        onConflict: 'script_id,lead_id',  // Critical: matches UNIQUE constraint
      })

    if (error) {
      console.error('Error recording outcome:', error)
      alert('Failed to record outcome: ' + error.message)
    } else {
      onSaved() // Refetch scripts to update counters
    }

    setIsSubmitting(false)
  }

  const selectedLead = leads.find(l => l.id === form.watch('lead_id'))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Call Outcome</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Script: <span className="font-medium">{script.title}</span>
          </p>
        </DialogHeader>

        <form className="space-y-4 py-4">
          {/* Lead selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Lead</label>
            <Controller
              name="lead_id"
              control={form.control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-left min-h-[48px] hover:border-gray-400"
                    >
                      {selectedLead
                        ? `${selectedLead.first_name} ${selectedLead.last_name}`
                        : 'Select lead...'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search leads..."
                        value={leadSearch}
                        onValueChange={setLeadSearch}
                      />
                      <CommandEmpty>No lead found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {leads.map((lead) => (
                          <CommandItem
                            key={lead.id}
                            value={`${lead.first_name} ${lead.last_name} ${lead.email}`}
                            onSelect={() => {
                              field.onChange(lead.id)
                              setLeadSearch('')
                            }}
                          >
                            <div className="flex flex-col py-1">
                              <span className="font-medium">
                                {lead.first_name} {lead.last_name}
                              </span>
                              <span className="text-sm text-gray-500">{lead.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />
            {form.formState.errors.lead_id && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.lead_id.message}
              </p>
            )}
          </div>

          {/* Outcome buttons - ABOVE notes for better mobile UX */}
          <div>
            <label className="text-sm font-medium mb-2 block">Outcome</label>
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => handleOutcome('success')}
                disabled={isSubmitting}
                className="
                  min-h-[48px] flex-1
                  flex items-center justify-center gap-2
                  bg-green-600 hover:bg-green-700
                  text-white font-semibold text-lg
                  rounded-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                <Check className="h-6 w-6" />
                Success
              </button>
              <button
                type="button"
                onClick={() => handleOutcome('fail')}
                disabled={isSubmitting}
                className="
                  min-h-[48px] flex-1
                  flex items-center justify-center gap-2
                  bg-red-600 hover:bg-red-700
                  text-white font-semibold text-lg
                  rounded-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                <X className="h-6 w-6" />
                Failed
              </button>
            </div>
          </div>

          {/* Notes - optional, below buttons */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              {...form.register('notes')}
              placeholder="Objections, follow-up timing, next steps..."
              rows={4}
              className="w-full"
            />
          </div>

          {/* Cancel button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### ScriptCard with Outcome Counters

```typescript
// Enhanced ScriptCard displaying aggregated outcome stats

interface ScriptCardProps {
  script: Script & {
    stats: {
      success_count: number
      fail_count: number
      total_count: number
      win_rate: number
    }
  }
  onRecordOutcome: () => void
  // ... existing props
}

export function ScriptCard({ script, onRecordOutcome, ... }: ScriptCardProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Existing card content */}
      <div onClick={onView} className="px-4 pt-4 pb-2 cursor-pointer hover:bg-gray-50">
        <h3 className="font-bold text-gray-900 mb-2 truncate">{script.title}</h3>
        <div className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
          {script.body}
        </div>
      </div>

      {/* Outcome stats - NEW */}
      {script.stats.total_count > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">
            ✓ {script.stats.success_count}
          </span>
          <span className="text-red-600 font-medium">
            ✗ {script.stats.fail_count}
          </span>
          <span className="text-gray-600">
            {script.stats.win_rate}% win rate
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className={`px-2 py-1 text-xs rounded-full ${...}`}>
          {script.is_active ? 'Active' : 'Inactive'}
        </span>

        <div className="flex gap-2">
          {/* Record Outcome button - NEW */}
          <button
            onClick={onRecordOutcome}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 min-h-[44px] px-2"
          >
            <Phone className="h-4 w-4" />
            Record Call
          </button>
          {/* Existing buttons: Edit, Mark Inactive */}
        </div>
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SELECT then INSERT/UPDATE | `.upsert()` with `onConflict` | PostgREST 7.0 (2020) | Eliminates race conditions, single query instead of two, atomic operation. |
| Client-side aggregation | PostgreSQL RPC with GROUP BY + aggregate functions | Established pattern | Leverages database indexes, avoids N+1 queries, consistent with existing codebase (get_revenue_by_period). |
| Native `<select>` dropdown | shadcn Combobox with search | 2023-2024 (Radix Primitives) | Searchable, keyboard navigable, accessible, mobile-friendly positioning, matches existing NicheComboBox. |
| 44x44px touch targets (Apple) | 48x48px touch targets (Android Material) | Material Design 3 (2023) | Universal standard, works across iOS and Android, better for accessibility. |
| Nested modal dialogs | Dialog state machine with mode switching | 2024-2026 UX best practice | Avoids confusing navigation, clearer back button behavior, less cognitive load on mobile. |

**Deprecated/outdated:**
- **Manual SELECT + INSERT/UPDATE**: Before PostgREST 7.0 upsert support, developers checked existence then branched. Prone to race conditions.
- **42x42px buttons**: Old iOS 6 standard (2012). Modern standard is 44x44px minimum (Apple) or 48x48px (Android).
- **Nested modals**: Still technically possible but universally discouraged in 2026 UX guidelines. "Infinite modal" pattern (mode switching) is current best practice.

## Open Questions

Things that couldn't be fully resolved:

1. **Should outcome recording auto-select the most recently contacted lead?**
   - What we know: Leads table has `status` field and `updated_at` timestamp
   - What's unclear: Is "most recently contacted" defined by status change or another event?
   - Recommendation: Start with manual selection (Combobox), add auto-select in Phase 17 if user feedback shows it's needed. Requires defining "recently contacted" logic first.

2. **Should script view dialog show outcome history for that script?**
   - What we know: View dialog shows full script body for reference during call
   - What's unclear: Do users want to see past outcomes while viewing script, or is that analytics territory (Phase 17)?
   - Recommendation: Keep view dialog focused on script content for MVP. Outcome history belongs in Phase 17 analytics view.

3. **How to handle existing outcomes when lead is deleted?**
   - What we know: `script_lead_outcomes.lead_id` has `ON DELETE CASCADE` - outcomes deleted when lead deleted
   - What's unclear: Should outcomes be preserved for analytics even after lead deletion?
   - Recommendation: Keep CASCADE for MVP (simpler). If analytics require historical outcomes without lead data, change to `ON DELETE SET NULL` + update RPC to handle null lead_id in Phase 17.

4. **Should notes be required or optional?**
   - What we know: Schema has `notes TEXT` (nullable)
   - What's unclear: Do users always have context to add, or is outcome (success/fail) sufficient?
   - Recommendation: Optional for MVP (matches schema). Monitor usage - if <10% of outcomes have notes, they're not valuable. If >50%, consider making required.

## Sources

### Primary (HIGH confidence)

**Supabase Upsert:**
- [Supabase JavaScript upsert documentation](https://supabase.com/docs/reference/javascript/upsert)
- [Supabase Discussion #36532: Upsert with composite unique constraint](https://github.com/orgs/supabase/discussions/36532)
- [Jon Meyers: Use On-conflict to Upsert in PostgreSQL](https://jonmeyers.io/blog/use-on-conflict-to-upsert-in-postgresql/)

**PostgreSQL Aggregation:**
- [PostgREST Aggregate Functions](https://supabase.com/blog/postgrest-aggregate-functions)
- [PostgREST Functions as RPC documentation](https://docs.postgrest.org/en/v12/references/api/functions.html)
- [Supabase Discussion #19517: How to GROUP BY?](https://github.com/orgs/supabase/discussions/19517)

**React Hook Form + Controlled Components:**
- [React Hook Form Controller documentation](https://react-hook-form.com/docs/usecontroller/controller)
- [shadcn/ui React Hook Form integration](https://ui.shadcn.com/docs/forms/react-hook-form)

**Mobile UX Standards:**
- [UX Movement: Optimal Size and Spacing for Mobile Buttons](https://uxmovement.com/mobile/optimal-size-and-spacing-for-mobile-buttons/)
- [Design Monks: Perfect Mobile Button Size](https://www.designmonks.co/blog/perfect-mobile-button-size)
- [Trinergy Digital: Mobile-First UX Design Best Practices 2026](https://www.trinergydigital.com/news/mobile-first-ux-design-best-practices-in-2026)

**Dialog UX Patterns:**
- [Eleken: Mastering Modal UX Best Practices](https://www.eleken.co/blog-posts/modal-ux)
- [UX Planet: Removing Nested Modals From Digital Products](https://uxplanet.org/removing-nested-modals-from-digital-products-6762351cf6de)
- [Fireart Studio: Alternative UX Patterns - Avoiding Nested Modals](https://fireart.studio/blog/learn-why-you-should-exclude-nested-models-from-your-design-and-how-to-replace-them/)

### Secondary (MEDIUM confidence)

**Combobox Patterns:**
- [shadcn Combobox documentation](https://ui.shadcn.com/docs/components/radix/combobox)
- [shadcn Studio: Combobox variants](https://shadcnstudio.com/docs/components/combobox)

**Call Tracking UX:**
- [SalesTrail: Automated Call Tracking](https://www.salestrail.io/)
- [Cometly: Phone Call Conversion Tracking Complete Guide 2026](https://www.cometly.com/post/phone-call-conversion-tracking)

### Tertiary (LOW confidence)

- General call tracking software features (Capterra, Single Grain) - validated against Supabase patterns
- Medium articles on GROUP BY in Supabase - validated against official PostgREST docs

## Metadata

**Confidence breakdown:**
- Supabase upsert pattern: HIGH - Official documentation, migration schema has UNIQUE constraint ready
- PostgreSQL RPC aggregation: HIGH - Matches existing get_revenue_by_period pattern, proven in Phase 4
- Mobile button sizing: HIGH - Apple HIG and Android Material standards are authoritative
- Combobox pattern: HIGH - Matches existing NicheComboBox from Phase 14, proven component
- Dialog state machine: HIGH - Existing ScriptManager pattern from Phase 15, extension is straightforward
- Lead selection UX: MEDIUM - Combobox is standard, but optimal lead pre-selection logic unclear (defer to user testing)

**Research date:** 2026-02-16
**Valid until:** ~30 days (stable stack, minor version updates possible)

**Key risks mitigated:**
- Upsert race conditions (onConflict handles atomically)
- N+1 query problem for counters (RPC function with GROUP BY)
- Mobile tap accuracy (48x48px minimum button size)
- Nested dialog confusion (state machine with mode switching)
- Validation gaps in Combobox (React Hook Form Controller)

**Integration with existing codebase:**
- Follows Phase 14 schema: `script_lead_outcomes` table ready with UNIQUE constraint
- Follows Phase 15 pattern: ScriptManager dialog state machine extends cleanly
- Follows Phase 4 pattern: PostgreSQL RPC for aggregation (matches get_revenue_by_period)
- Follows Phase 14 pattern: Combobox for selection (matches NicheComboBox)
- Consistent with STACK-v1.4.md: React Hook Form + Zod already standard

**Critical success factors:**
1. **onConflict value must exactly match UNIQUE constraint** - most common error source
2. **RPC function must LEFT JOIN to handle scripts with zero outcomes** - else counters missing
3. **Combobox must use Controller for validation** - else no error messages
4. **RefreshScripts() must be called after outcome save** - else counters stale
5. **Buttons must be 48x48px minimum** - else mobile UX suffers
