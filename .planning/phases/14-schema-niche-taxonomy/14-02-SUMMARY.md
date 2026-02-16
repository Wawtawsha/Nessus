---
phase: 14-schema-niche-taxonomy
plan: 02
subsystem: ui
tags: [react, supabase, combobox, leads, niche]

# Dependency graph
requires:
  - phase: 14-schema-niche-taxonomy
    plan: 01
    provides: niches table, niche_id on leads, Niche TypeScript type
provides:
  - NicheComboBox component (searchable combo with inline creation)
  - Leads list page with niche column, niche filter, niche in Add Lead dialog
  - Lead detail page with niche in view and edit modes
affects: [15-script-library-crud]

# Tech tracking
tech-stack:
  added: ["cmdk@1"]
  patterns:
    - "Relative-positioned dropdown instead of Radix Popover (avoids dialog stacking issue)"
    - "Fire-and-forget API calls for non-blocking side effects"
    - "Email fallback display when lead names are null"

key-files:
  created:
    - crm-dashboard/components/ui/command.tsx
    - crm-dashboard/components/NicheComboBox.tsx
  modified:
    - crm-dashboard/app/(dashboard)/leads/page.tsx
    - crm-dashboard/app/(dashboard)/leads/[id]/page.tsx
    - crm-dashboard/types/lead.ts

key-decisions:
  - "Plain relative-positioned dropdown instead of Radix Popover — Popover portals to document.body which renders behind native <dialog> stacking context"
  - "first_name and last_name made nullable on leads table — enables email-only leads from photo download flow"
  - "Email displayed as fallback when lead name is null in list and detail views"

patterns-established:
  - "Relative dropdown pattern for components inside <dialog> elements"
  - "Nullable name fields with email fallback display"

# Metrics
duration: ~45min (including bug fix and photo-download lead feature)
completed: 2026-02-16
---

# Phase 14 Plan 02: NicheComboBox + Leads Integration Summary

**Built NicheComboBox component with inline niche creation and integrated niche selection across leads list (column, filter, Add Lead) and lead detail (view/edit modes). Fixed Radix Popover dialog stacking bug. Added photo download → lead creation pipeline.**

## Performance

- **Tasks:** 3 auto + 1 checkpoint (all complete)
- **Files modified:** 5
- **Commits:** 157c75e, 369183e, 44ce876, 079c4e1, 7f5ae23

## Accomplishments
- NicheComboBox: searchable combo selector with inline niche creation, duplicate handling (23505), "(None)" clear option
- Leads list: niche column (joined via `select('*, niche:niches(name)')`), niche filter dropdown, NicheComboBox in Add Lead dialog
- Lead detail: niche display in view mode, NicheComboBox in edit mode with change tracking
- Bug fix: Rewrote NicheComboBox from Radix Popover to plain relative dropdown (Popover portals behind `<dialog>`)
- Photo download lead capture: submit-lead v4 (optional names, notes field), DownloadQueueBlade integration, email-only leads with nullable first_name/last_name

## Deviations from Plan
1. **NicheComboBox uses plain HTML dropdown instead of Radix Popover+Command** — Radix Popover portals content to `document.body`, which renders behind native `<dialog>` element stacking context. Replaced with simple relative-positioned dropdown using plain HTML buttons.
2. **Added photo download → lead creation** — Out of scope for plan but requested by user. Updated submit-lead edge function (v4), modified Shrike website DownloadQueueBlade, made first_name/last_name nullable in leads table.

## Issues Encountered
- Radix UI Popover inside `<dialog>`: Portal renders behind dialog stacking context. Resolved by replacing with relative-positioned dropdown.
- Vercel CLI `vercel link` overwrote `.env.local` removing Supabase keys. Resolved by restoring from Supabase API.

## Files Created/Modified
- `crm-dashboard/components/ui/command.tsx` — shadcn Command component (cmdk wrapper)
- `crm-dashboard/components/NicheComboBox.tsx` — Searchable combo selector with inline niche creation
- `crm-dashboard/app/(dashboard)/leads/page.tsx` — Niche column, filter, Add Lead integration, email fallback display
- `crm-dashboard/app/(dashboard)/leads/[id]/page.tsx` — Niche view/edit mode, email fallback display
- `crm-dashboard/types/lead.ts` — first_name/last_name now `string | null`, niche_id field

---
*Phase: 14-schema-niche-taxonomy*
*Completed: 2026-02-16*
