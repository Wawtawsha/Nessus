---
phase: 15-script-library-crud
plan: 01
subsystem: ui
tags: [react, supabase, scripts, crud, react-hook-form, zod, shadcn]

# Dependency graph
requires:
  - phase: 14-schema-niche-taxonomy
    plan: 01
    provides: scripts table, Script DB schema, RLS policies
provides:
  - ScriptManager component (CRUD orchestration with view/add/edit/soft-delete)
  - AddEditScriptDialog (create/edit form with RHF + Zod validation)
  - ScriptCard (display card with action buttons)
  - Script TypeScript interface
  - scriptSchema Zod schema for form validation
  - Collapsible Call Scripts section on leads page
affects: [16-outcome-tracking]

# Tech tracking
tech-stack:
  added: ["react-hook-form", "zod", "@hookform/resolvers", "shadcn/ui dialog", "shadcn/ui textarea"]
  patterns:
    - React Hook Form with Zod resolver for type-safe form validation
    - shadcn Dialog component for modals with proper accessibility
    - Soft delete pattern (is_active flag) instead of hard deletes
    - View/Edit mode switching within dialog workflow
    - Collapsible sections for progressive disclosure
    - Mobile-first design with min-h-[44px] touch targets

key-files:
  created:
    - crm-dashboard/components/ScriptManager.tsx - CRUD orchestration component
    - crm-dashboard/components/AddEditScriptDialog.tsx - Form dialog (create/edit)
    - crm-dashboard/components/ScriptCard.tsx - Script display card
    - crm-dashboard/types/script.ts - Script TypeScript interface
    - crm-dashboard/lib/schemas/scriptSchema.ts - Zod validation schema
    - crm-dashboard/components.json - shadcn CLI configuration
    - crm-dashboard/components/ui/dialog.tsx - shadcn Dialog component
    - crm-dashboard/components/ui/textarea.tsx - shadcn Textarea component
  modified:
    - crm-dashboard/app/(dashboard)/leads/page.tsx - Added collapsible Call Scripts section
    - crm-dashboard/package.json - Added form dependencies

key-decisions:
  - is_active field excluded from form schema - toggling is a separate action via dedicated button, not part of create/edit flow
  - Used mode: 'onSubmit' in useForm config - prevents shadcn Dialog X button from triggering validation errors (known pitfall)
  - Default filter: is_active = true - only show active scripts in list, soft-deleted scripts hidden
  - Scripts default to expanded state (scriptsExpanded = true) - assumes scripts are immediately useful for cold calling workflow
  - View mode is separate dialog - allows reading full script without editing controls
  - Edit button in view dialog - enables quick transition from read to edit mode
  - Scripts section only shows when currentClientId exists - matches leads_only client_type pattern

patterns-established:
  - Soft delete workflow: Mark Inactive action -> confirm -> update is_active -> refetch
  - Dialog mode state machine: 'closed' | 'add' | 'edit' | 'view' - single state variable controls all dialog variations
  - ScriptManager as orchestrator - no business logic in ScriptCard, all CRUD in manager
  - Textarea with whitespace-pre-wrap - preserves formatting in multi-line scripts
  - line-clamp-3 for preview - shows first 3 lines in card, full text in view dialog
  - Responsive grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 - adapts to screen size
  - Error handling via console.error + alert() - matches existing leads page pattern

# Metrics
duration: ~8min
completed: 2026-02-16
---

# Phase 15 Plan 01: Script Library CRUD Summary

**Full CRUD interface for call scripts on Cold Calling leads page with RHF+Zod validation, soft deletes, and view/edit workflows.**

## Performance
- Tasks: 3 auto (all complete)
- Files modified: 10 (8 created, 2 modified)
- Commits: 3 (b3ba66b, 2716710, f5d1b45)
- Leads page bundle: 4.8 kB → 48.9 kB (+44.1 kB for full CRUD UI)

## Accomplishments

### Task 1: Dependencies and Type Infrastructure
- Installed react-hook-form, zod, @hookform/resolvers for type-safe form handling
- Added shadcn Dialog and Textarea components via shadcn CLI
- Created Script TypeScript interface matching scripts table schema (id, client_id, title, body, is_active, timestamps, created_by)
- Created scriptSchema Zod schema with title (1-200 chars) and body (required) validation
- Created components.json config to enable shadcn CLI for future component additions

### Task 2: Component Architecture
- **ScriptCard** - Display component showing:
  - Title (truncated to 1 line)
  - Body preview (line-clamp-3 for first 3 lines)
  - Active/Inactive status badge (green/gray pills)
  - Edit button (blue, Pencil icon)
  - Mark Inactive/Reactivate button (red/green, EyeOff/Eye icons)
  - Click-to-view full script (entire card clickable except buttons)
  - Mobile-friendly 44px touch targets

- **AddEditScriptDialog** - Form dialog with:
  - Dual mode: create (script undefined) or edit (script provided)
  - React Hook Form with zodResolver(scriptSchema)
  - mode: 'onSubmit' to prevent Dialog X button from triggering validation
  - useEffect to reset form when script prop changes (handles switching edit targets)
  - Title input field with Tailwind styling
  - Textarea with rows={10} and whitespace-pre-wrap
  - Error messages below each field (red text-sm)
  - Loading states: "Creating..." / "Saving..." / "Create Script" / "Save Changes"
  - Supabase insert (create) or update (edit) with updated_at timestamp
  - onSaved callback for parent refetch, onClose for cleanup

- **ScriptManager** - Orchestration component managing:
  - Fetch scripts filtered by client_id and is_active = true
  - DialogMode state: 'closed' | 'add' | 'edit' | 'view'
  - selectedScript state for tracking current script
  - Add Script button (right-aligned, blue)
  - Loading state ("Loading scripts...")
  - Empty state ("No scripts yet. Create your first call script to get started.")
  - Responsive grid (1/2/3 columns on sm/md/lg)
  - ScriptCard callbacks: onEdit, onView, onToggleActive
  - Soft delete confirmation: window.confirm before marking inactive
  - View Dialog with full script text, Close and Edit buttons
  - Edit button in view dialog switches to edit mode (keeps selectedScript)

### Task 3: Leads Page Integration
- Added ScriptManager import
- Added scriptsExpanded state (default true)
- Inserted collapsible Call Scripts section between filters and leads table
- Collapsible header with "Hide"/"Show" toggle
- Only renders when currentClientId exists (matches leads_only client pattern)
- Seamless visual integration with existing white card + shadow styling

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None - all dependencies installed correctly, shadcn CLI worked after creating components.json, build passed on all iterations.

## Files Created/Modified

### Created
1. **crm-dashboard/components.json** - shadcn CLI configuration (enables `npx shadcn add`)
2. **crm-dashboard/components/ui/dialog.tsx** - shadcn Dialog component (Radix UI wrapper)
3. **crm-dashboard/components/ui/textarea.tsx** - shadcn Textarea component
4. **crm-dashboard/types/script.ts** - Script interface matching DB schema
5. **crm-dashboard/lib/schemas/scriptSchema.ts** - Zod schema for title/body validation
6. **crm-dashboard/components/ScriptCard.tsx** - Display card with view/edit/toggle actions
7. **crm-dashboard/components/AddEditScriptDialog.tsx** - Create/edit form dialog with RHF+Zod
8. **crm-dashboard/components/ScriptManager.tsx** - CRUD orchestrator with view/add/edit/soft-delete

### Modified
1. **crm-dashboard/package.json** - Added react-hook-form, zod, @hookform/resolvers, @radix-ui/react-dialog
2. **crm-dashboard/app/(dashboard)/leads/page.tsx** - Added collapsible Call Scripts section with ScriptManager

## Next Steps
Phase 16 (Outcome Tracking) can now:
- Reference scripts in call outcome records (FK to scripts.id)
- Track which scripts perform best
- Analyze conversion rates by script
- Display script usage metrics in analytics

## Technical Notes

### Form Validation Pattern
The AddEditScriptDialog demonstrates a clean RHF + Zod pattern:
```typescript
const { register, handleSubmit, formState: { errors }, reset } = useForm<ScriptFormValues>({
  resolver: zodResolver(scriptSchema),
  mode: 'onSubmit', // Critical: prevents Dialog X button validation errors
})
```

### Soft Delete Pattern
Scripts use `is_active` flag instead of hard deletes:
- Default query: `.eq('is_active', true)` - only show active scripts
- Toggle action: `UPDATE scripts SET is_active = false` - preserves data
- Future: Admin interface can show all scripts, allow reactivation

### Dialog State Machine
ScriptManager uses a clean state machine for dialog modes:
```typescript
type DialogMode = 'closed' | 'add' | 'edit' | 'view'
const [dialogMode, setDialogMode] = useState<DialogMode>('closed')
```
This avoids boolean flag proliferation (isAddOpen, isEditOpen, isViewOpen).

### Mobile UX Considerations
- All action buttons use `min-h-[44px]` for touch targets (iOS HIG guideline)
- Cards use `cursor-pointer hover:bg-gray-50` for clear interaction affordance
- Responsive grid adapts to screen size (1/2/3 columns)
- Textarea has adequate editing space (rows={10})

## User Workflow
1. User visits /leads page (Cold Calling client selected)
2. Call Scripts section visible above leads table (expanded by default)
3. User clicks "Add Script" → dialog opens → fills title/body → "Create Script"
4. Script appears in grid as card
5. User clicks card → view dialog with full text
6. User clicks "Edit" in view dialog → switches to edit mode
7. User edits script → "Save Changes" → updates
8. User clicks "Mark Inactive" → confirm → script removed from list (soft delete)

## RLS Security
Scripts table RLS policies (from Phase 14) ensure:
- Users only see scripts for clients they have access to (via user_clients join)
- INSERT requires user to be in user_clients for target client_id
- UPDATE/DELETE require user to own the script's client
