# Phase 15: Script Library CRUD - Research

**Researched:** 2026-02-16
**Domain:** CRUD operations for call script management in React + Next.js 14 + Supabase
**Confidence:** HIGH

## Summary

Phase 15 implements create, read, update, and delete operations for call scripts within the existing Cold Calling leads page. The research examines form handling patterns (React Hook Form + Zod), dialog-based CRUD UX, mobile-optimized button sizing, optimistic updates, and text editing patterns for script content.

**Context from prior phases:**
- Phase 14 created the `scripts` table with soft delete (`is_active` flag), RLS policies, and indexes
- Schema includes: `id`, `client_id`, `title`, `body`, `is_active`, `created_at`, `updated_at`
- NicheComboBox component already exists (Phase 14) for user-managed taxonomy
- Existing research documents confirm: shadcn Dialog + React Hook Form + Zod is the standard stack

**Key architectural decisions:**
1. **Dialog-based CRUD**: Use shadcn Dialog (not native HTML dialog) for create/edit script forms
2. **Form library**: React Hook Form + Zod for validation (install via npm, already researched in STACK-v1.4.md)
3. **Mobile-first**: 44x44px minimum touch targets for success/fail buttons (Apple HIG standard)
4. **Optimistic updates**: Use React's useOptimistic hook for instant UI feedback during mutations
5. **Script content**: Plain textarea with optional Markdown rendering (defer rich text editor to post-MVP)

**Primary recommendation:** Build a ScriptManager component with inline add/edit/delete actions, display script cards with aggregated counters, and use shadcn Dialog for forms.

## Standard Stack

The established libraries/tools for script CRUD in Next.js + Supabase context:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.71.0 | Form state management | Minimal re-renders (9.4kB gzipped), uncontrolled components, de facto standard for React forms. Latest stable v7.x. |
| zod | ^4.3.6 | Schema validation | TypeScript-first validation, single source of truth for client + server validation, generates types from schemas. Latest v4 adds exclusive unions and file validation. |
| @hookform/resolvers | ^3.10.0 | Bridge RHF + Zod | Official adapter for using Zod schemas with React Hook Form, seamless integration. |
| @radix-ui/react-dialog | ^1.1.5 | Accessible dialog primitive | Used via shadcn Dialog component. Focus trapping, ESC key handling, backdrop dismiss, portal rendering. Industry standard for React modals. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @uiw/react-md-editor | ^4.0.4 | Markdown editor (optional) | If users request formatting toolbar or live preview. Lightweight (~20kB), GitHub Flavored Markdown support. |
| react-markdown | ^9.0.0 | Markdown renderer (optional) | If storing scripts as Markdown and rendering with formatting. Minimal (~15kB). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | Formik is heavier (15kB vs 9kB), more verbose API, less TypeScript-friendly. RHF is more performant. |
| Zod | Yup | Yup has weaker TypeScript inference, not TypeScript-first. Zod is better for type safety. |
| shadcn Dialog | Native HTML `<dialog>` | Native dialog lacks focus trapping, inconsistent browser support, no portal rendering. shadcn is more accessible and consistent. |
| Plain textarea | Rich text editor (Quill, Tiptap) | Rich text adds 50-100kB bundle size and complexity. Plain textarea + optional Markdown is simpler for MVP. |

**Installation:**
```bash
cd crm-dashboard
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest add dialog textarea
```

**Note:** shadcn Command and Popover components are already installed from Phase 14 (NicheComboBox).

## Architecture Patterns

### Recommended Project Structure

```
crm-dashboard/
├── components/
│   ├── AddEditScriptDialog.tsx      # Create/Edit script form (shadcn Dialog)
│   ├── ScriptManager.tsx             # Script list with CRUD actions
│   ├── ScriptCard.tsx                # Single script display with counters
│   └── ui/
│       ├── dialog.tsx                # shadcn Dialog component
│       └── textarea.tsx              # shadcn Textarea component
├── app/(dashboard)/clients/[id]/
│   └── leads/
│       └── page.tsx                  # Cold Calling leads page (conditionally shows ScriptManager)
└── lib/
    └── schemas/
        └── scriptSchema.ts           # Zod validation schema for scripts
```

### Pattern 1: Dialog-Based CRUD Form

**What:** Single dialog component handles both create and edit modes based on props.

**When to use:** Any CRUD form where create and edit share the same fields.

**Example:**

```typescript
// Source: shadcn/ui React Hook Form documentation
// https://ui.shadcn.com/docs/forms/react-hook-form

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const scriptSchema = z.object({
  title: z.string().min(1, "Title required").max(200, "Title too long"),
  body: z.string().min(1, "Script body required"),
  is_active: z.boolean().default(true),
})

type ScriptFormValues = z.infer<typeof scriptSchema>

interface AddEditScriptDialogProps {
  script?: { id: string; title: string; body: string; is_active: boolean } // Edit mode
  clientId: string
  onClose: () => void
  onSave: () => void
}

export function AddEditScriptDialog({ script, clientId, onClose, onSave }: AddEditScriptDialogProps) {
  const form = useForm<ScriptFormValues>({
    resolver: zodResolver(scriptSchema),
    defaultValues: script || { title: "", body: "", is_active: true },
  })

  const onSubmit = async (data: ScriptFormValues) => {
    if (script) {
      // Edit mode
      await supabase
        .from("scripts")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", script.id)
    } else {
      // Create mode
      await supabase.from("scripts").insert({ ...data, client_id: clientId })
    }
    onSave()
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{script ? "Edit Script" : "Add New Script"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <input {...form.register("title")} className="w-full border rounded px-3 py-2" />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Script Body</label>
            <Textarea {...form.register("body")} rows={10} className="w-full" />
            {form.formState.errors.body && (
              <p className="text-sm text-red-500">{form.formState.errors.body.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...form.register("is_active")} />
            <label className="text-sm">Active</label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
              {script ? "Save Changes" : "Create Script"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern 2: Optimistic Updates for Instant Feedback

**What:** Update UI immediately before server response, roll back on error.

**When to use:** High success rate actions where immediate feedback matters (create, delete, toggle active).

**Example:**

```typescript
// Source: Next.js useOptimistic documentation
// https://github.com/dijonmusters/build-a-twitter-clone-with-the-next.js-app-router-and-supabase

import { useOptimistic, startTransition } from "react"

function ScriptManager({ clientId }: { clientId: string }) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [optimisticScripts, addOptimisticScript] = useOptimistic(
    scripts,
    (state, newScript: Script) => [...state, newScript]
  )

  const handleAddScript = async (data: ScriptFormValues) => {
    const tempId = `temp-${Date.now()}`
    const optimisticScript = { ...data, id: tempId, client_id: clientId }

    startTransition(() => {
      addOptimisticScript(optimisticScript)
    })

    const { data: savedScript, error } = await supabase
      .from("scripts")
      .insert({ ...data, client_id: clientId })
      .select()
      .single()

    if (!error) {
      setScripts([...scripts, savedScript])
    } else {
      // Rollback on error
      setScripts(scripts)
      toast.error("Failed to create script")
    }
  }

  return (
    <div>
      {optimisticScripts.map((script) => (
        <ScriptCard key={script.id} script={script} />
      ))}
    </div>
  )
}
```

### Pattern 3: Mobile-Optimized Touch Targets

**What:** Buttons sized for finger taps, not mouse clicks. Minimum 44x44px.

**When to use:** Any action buttons on mobile devices (success/fail, delete, edit).

**Example:**

```tsx
// Source: Apple HIG and WCAG 2.5.5 guidelines
// https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/

// Mobile-first button sizing
<button
  className="
    min-w-[44px] min-h-[44px]           // Apple HIG minimum (44x44 points)
    md:min-w-[48px] md:min-h-[48px]    // Android Material (48x48 dp)
    p-3                                 // Inner padding for visual comfort
    text-lg md:text-base               // Larger text on mobile
    rounded-lg
    bg-green-600 text-white
  "
>
  Mark Success
</button>

// Stack buttons vertically on mobile, horizontal on desktop
<div className="
  flex flex-col gap-3              // Mobile: stacked with 12px gap
  md:flex-row md:gap-2            // Desktop: horizontal with 8px gap
">
  <button className="min-h-[44px] flex-1">Success</button>
  <button className="min-h-[44px] flex-1">Fail</button>
</div>
```

### Pattern 4: Textarea Auto-Resize (Optional Enhancement)

**What:** Textarea grows with content, no scrolling required.

**When to use:** Script body editing where users may write long scripts.

**Example:**

```typescript
// Source: Material-UI TextareaAutosize pattern
// https://mui.com/material-ui/react-textarea-autosize/

import { useEffect, useRef } from "react"

function AutoResizeTextarea({ value, onChange, ...props }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className="w-full resize-none overflow-hidden"
      rows={4}
      {...props}
    />
  )
}
```

### Anti-Patterns to Avoid

- **Inline editing without dialog**: Editing script title/body inline in the list view causes accidental edits and poor mobile UX. Use modal dialogs.
- **Uncontrolled forms**: Using native HTML form submission without React Hook Form loses validation, error handling, and TypeScript safety.
- **Hard delete on first click**: Accidentally deleting scripts is high risk. Use soft delete (is_active toggle) or confirmation dialog.
- **No loading states**: Buttons without disabled/loading states allow double-submission. Always disable during submission.
- **Client-side only validation**: Validation must happen both client-side (UX) and server-side (security). Zod schemas can be reused on both.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation functions per field | Zod schemas + React Hook Form | Zod provides type inference, reusable schemas, nested validation, custom error messages. Hand-rolled validation is verbose and error-prone. |
| Dialog accessibility | Custom modal with useState + CSS | shadcn Dialog (Radix Primitives) | Focus trapping, ESC key, backdrop click, portal rendering, ARIA attributes, keyboard navigation all require complex logic. Radix handles it. |
| Optimistic updates | Manual state rollback logic | React useOptimistic hook | Race conditions, error handling, state reconciliation are hard. useOptimistic handles it declaratively. |
| Textarea auto-resize | onInput event handlers + height calculations | shadcn Textarea or dedicated library | Edge cases: initial height, dynamic content, browser differences. Libraries handle all cases. |
| Markdown rendering | Regex find-and-replace for **bold**, *italic* | react-markdown | Markdown has complex parsing rules (nested lists, code blocks, escaping). Regex breaks on edge cases. |

**Key insight:** Form handling in React has matured to the point where the "standard stack" (React Hook Form + Zod + shadcn) solves 95% of use cases with minimal code. Hand-rolling form state, validation, or dialogs is premature optimization and introduces bugs.

## Common Pitfalls

### Pitfall 1: Dialog Close Button Triggers Validation Errors

**What goes wrong:** When using React Hook Form with `mode: 'all'` (validate on every change), clicking the dialog's X button or backdrop triggers validation for incomplete fields. Error messages appear, and the dialog requires two clicks to close.

**Why it happens:** Dialog close handlers are treated as form interactions. React Hook Form validates on every state change in `mode: 'all'`, including when the dialog's open state changes.

**How to avoid:**
```typescript
// Option 1: Use mode: 'onSubmit' instead of 'all'
const form = useForm({
  resolver: zodResolver(scriptSchema),
  mode: "onSubmit", // Only validate on submit, not every change
})

// Option 2: Reset form on dialog close
const onClose = () => {
  form.reset()
  closeDialog()
}

// Option 3: Wrap close button in type="button" to prevent form submission
<button type="button" onClick={onClose}>Cancel</button>
```

**Warning signs:**
- Validation errors appear when clicking cancel or X button
- Dialog requires multiple clicks to close
- Form errors persist after closing dialog

**Source:** [shadcn-ui/ui Issue #3843](https://github.com/shadcn-ui/ui/issues/3843)

### Pitfall 2: Missing RLS Policies on INSERT/UPDATE

**What goes wrong:** User creates a script, but RLS prevents INSERT without explicit policy. Error: "new row violates row-level security policy for table 'scripts'". Script creation silently fails or shows generic error.

**Why it happens:** Phase 14 created SELECT policies for scripts, but INSERT/UPDATE/DELETE policies may not cover all cases. RLS requires explicit policies for EVERY operation type.

**How to avoid:**

```sql
-- Ensure all CRUD policies exist (Phase 14 should have created these)
CREATE POLICY scripts_insert ON scripts FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY scripts_update ON scripts FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY scripts_delete ON scripts FOR DELETE
  USING (
    client_id IN (
      SELECT client_id FROM user_clients WHERE user_id = auth.uid()
    )
  );
```

**Warning signs:**
- Generic "permission denied" errors on create/update/delete
- Queries work in Supabase SQL editor but fail in app
- Error messages mention "row-level security policy"

### Pitfall 3: No Loading State During Mutations

**What goes wrong:** User clicks "Create Script", nothing happens visibly, they click again, and two scripts are created.

**Why it happens:** Supabase mutations take 100-300ms. Without visual feedback, users assume the button didn't work and click repeatedly.

**How to avoid:**

```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const onSubmit = async (data: ScriptFormValues) => {
  if (isSubmitting) return // Prevent double-submission

  setIsSubmitting(true)
  try {
    await supabase.from("scripts").insert(data)
    toast.success("Script created!")
  } catch (error) {
    toast.error("Failed to create script")
  } finally {
    setIsSubmitting(false)
  }
}

return (
  <button
    type="submit"
    disabled={isSubmitting}
    className="disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isSubmitting ? "Creating..." : "Create Script"}
  </button>
)
```

**Warning signs:**
- Duplicate records in database
- Users report "I clicked once but got multiple"
- No visual feedback during save

### Pitfall 4: Soft Delete Not Filtering in Queries

**What goes wrong:** Scripts table has `is_active` for soft delete, but queries don't filter by it. "Deleted" scripts still appear in the list.

**Why it happens:** Forgot to add `.eq('is_active', true)` to SELECT queries after implementing soft delete.

**How to avoid:**

```typescript
// WRONG: Shows deleted scripts
const { data: scripts } = await supabase
  .from("scripts")
  .select("*")
  .eq("client_id", clientId)

// RIGHT: Only show active scripts
const { data: scripts } = await supabase
  .from("scripts")
  .select("*")
  .eq("client_id", clientId)
  .eq("is_active", true) // Critical filter
  .order("created_at", { desc: true })
```

**Warning signs:**
- "Deleted" scripts reappear in list
- Script count includes inactive scripts
- Analytics include outcomes from inactive scripts

### Pitfall 5: Textarea Without Proper Newline Handling

**What goes wrong:** User writes script with line breaks, saves, but when displayed, all line breaks are gone (renders as single paragraph).

**Why it happens:** HTML collapses whitespace by default. `\n` characters in text nodes are treated as spaces unless explicitly preserved.

**How to avoid:**

```tsx
// Option 1: CSS whitespace preservation
<div className="whitespace-pre-wrap">{script.body}</div>

// Option 2: Convert newlines to <br> tags
<div dangerouslySetInnerHTML={{ __html: script.body.replace(/\n/g, '<br>') }} />

// Option 3: Use <pre> tag (but loses text wrapping)
<pre className="font-sans whitespace-pre-wrap">{script.body}</pre>
```

**Warning signs:**
- Script displays as single paragraph despite newlines in database
- User complains "my formatting disappeared"
- Textarea shows newlines but display doesn't

## Code Examples

Verified patterns from official sources:

### Zod Schema for Script Validation

```typescript
// Source: Zod documentation
// https://zod.dev/

import { z } from "zod"

export const scriptSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .trim(),
  body: z
    .string()
    .min(1, "Script body is required")
    .max(10000, "Script is too long (max 10,000 characters)")
    .trim(),
  is_active: z.boolean().default(true),
})

export type ScriptFormValues = z.infer<typeof scriptSchema>

// Client-side usage
const form = useForm<ScriptFormValues>({
  resolver: zodResolver(scriptSchema),
})

// Server-side usage (if using Next.js Server Actions)
export async function createScript(formData: FormData) {
  const parsed = scriptSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    is_active: formData.get("is_active") === "on",
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Insert into database
  await supabase.from("scripts").insert(parsed.data)
}
```

### Complete ScriptManager Component

```typescript
// Source: Supabase Next.js CRUD patterns
// https://makerkit.dev/courses/nextjs-app-router/managing-posts

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { AddEditScriptDialog } from "./AddEditScriptDialog"
import { ScriptCard } from "./ScriptCard"

interface Script {
  id: string
  client_id: string
  title: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function ScriptManager({ clientId }: { clientId: string }) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingScript, setEditingScript] = useState<Script | undefined>()

  const supabase = createClientComponentClient()

  const fetchScripts = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("scripts")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { desc: true })

    if (!error && data) {
      setScripts(data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchScripts()
  }, [clientId])

  const handleAdd = () => {
    setEditingScript(undefined)
    setDialogOpen(true)
  }

  const handleEdit = (script: Script) => {
    setEditingScript(script)
    setDialogOpen(true)
  }

  const handleDelete = async (scriptId: string) => {
    if (!confirm("Mark this script as inactive?")) return

    await supabase
      .from("scripts")
      .update({ is_active: false })
      .eq("id", scriptId)

    fetchScripts()
  }

  const handleSave = () => {
    fetchScripts()
  }

  if (isLoading) {
    return <div>Loading scripts...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Call Scripts</h2>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Script
        </button>
      </div>

      {scripts.length === 0 ? (
        <p className="text-gray-500">No scripts yet. Create your first script to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              onEdit={() => handleEdit(script)}
              onDelete={() => handleDelete(script.id)}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <AddEditScriptDialog
          script={editingScript}
          clientId={clientId}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik + Yup | React Hook Form + Zod | 2023-2024 | RHF is more performant (uncontrolled inputs), Zod has better TypeScript inference and type safety. |
| Native HTML `<dialog>` | Radix Dialog (via shadcn) | 2023-2024 | Radix provides consistent accessibility, focus management, and portal rendering across browsers. |
| Manual optimistic updates | React useOptimistic hook | React 19 (2024) | Built-in hook simplifies state rollback and error handling. |
| Server Actions only | Server Actions + client mutations | 2025-2026 | Hybrid approach: Server Actions for sensitive operations, client mutations for instant feedback. |
| Rich text editors (Quill, Draft.js) | Plain textarea + Markdown | 2024-2026 | Markdown is lighter (15kB vs 100kB), more portable, version-control friendly. Rich text deferred to pro features. |

**Deprecated/outdated:**
- **Formik**: Still maintained but heavier and less performant than React Hook Form. Community momentum shifted to RHF.
- **Final Form**: No longer actively maintained (last update 2021). Avoid for new projects.
- **Custom dialog implementations**: Before Radix Primitives, developers built dialogs from scratch. This is now an anti-pattern due to accessibility complexity.

## Open Questions

Things that couldn't be fully resolved:

1. **Markdown vs plain text for script body**
   - What we know: Plain textarea is simplest, Markdown adds formatting without heavy editor
   - What's unclear: Do users need formatting? How often do they write structured scripts vs freeform?
   - Recommendation: Start with plain textarea, add Markdown renderer if users request formatting (can migrate existing content easily)

2. **Script versioning approach**
   - What we know: Phase 14 research deferred versioning to post-MVP (PITFALLS.md #7)
   - What's unclear: If user edits script, should outcomes link to original or updated version?
   - Recommendation: No versioning for Phase 15. Outcomes link to script ID, script body can change. Add versioning in later phase if analytics require historical context.

3. **Delete vs Archive UX terminology**
   - What we know: Database uses soft delete (`is_active = false`)
   - What's unclear: Should UI say "Delete" or "Archive"? Users may expect "Delete" to be permanent.
   - Recommendation: UI says "Mark Inactive" or toggle switch. "Delete" implies permanent removal, which conflicts with soft delete pattern.

4. **Auto-save vs explicit save**
   - What we know: Explicit save button is standard for forms
   - What's unclear: Should script edits auto-save (like Google Docs) or require save button?
   - Recommendation: Explicit save for MVP (matches existing CRM patterns). Auto-save adds complexity (debouncing, conflict resolution, loading indicators).

## Sources

### Primary (HIGH confidence)

**React Hook Form + Zod:**
- [React Hook Form documentation](https://react-hook-form.com/)
- [shadcn/ui React Hook Form integration](https://ui.shadcn.com/docs/forms/react-hook-form)
- [Building React Forms with React Hook Form, Zod and Shadcn](https://wasp.sh/blog/2024/11/20/building-react-forms-with-ease-using-react-hook-form-and-zod)
- [Zod v4 release notes](https://zod.dev/v4)

**Dialog Patterns:**
- [shadcn Dialog documentation](https://ui.shadcn.com/docs/components/radix/dialog)
- [Building a Confirmation Dialog in React with TypeScript](https://medium.com/@hrupanjan/building-a-flexible-confirmation-dialog-system-in-react-or-next-js-with-typescript-1e57965b523b)
- [shadcn-ui Issue #3843: Dialog close button validation](https://github.com/shadcn-ui/ui/issues/3843)

**Next.js + Supabase CRUD:**
- [Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [CRUD operations with Next.js Server Actions and Supabase](https://makerkit.dev/courses/nextjs-app-router/managing-posts)
- [Optimizing Data Operations in Next.js 14 and Supabase](https://www.usenextbase.com/docs/v3/guides/optimizing-data-operations-nextjs-supabase)

**Optimistic Updates:**
- [Next.js useOptimistic documentation](https://nextjs.org/docs/app/getting-started/updating-data)
- [Implement optimistic UI with useTransition](https://github.com/dijonmusters/build-a-twitter-clone-with-the-next.js-app-router-and-supabase/blob/main/17-implement-optimistic-ui-with-the-next.js-usetransition-hook/README.md)
- [How to Use Supabase with TanStack Query](https://makerkit.dev/blog/saas/supabase-react-query)

**Mobile Accessibility:**
- [Apple HIG touch target sizes](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)
- [Accessible touch target sizes cheatsheet](https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/)
- [WCAG 2.5.5 Target Size requirements](https://www.accessguide.io/guide/large-target-size)

### Secondary (MEDIUM confidence)

**Textarea Patterns:**
- [Material-UI TextareaAutosize](https://mui.com/material-ui/react-textarea-autosize/)
- [@uiw/react-md-editor](https://uiwjs.github.io/react-md-editor/)
- [Creating Polished Content with React Markdown](https://refine.dev/blog/react-markdown/)

### Tertiary (LOW confidence)

- WebSearch results on general CRUD patterns (validated against official docs)
- Medium articles on form patterns (validated against shadcn/React Hook Form docs)

## Metadata

**Confidence breakdown:**
- Standard stack (React Hook Form + Zod + shadcn Dialog): HIGH - Official documentation, community consensus, already researched in STACK-v1.4.md
- Architecture patterns: HIGH - Proven patterns from existing codebase (Phase 14) and official examples
- Pitfalls: HIGH - Verified via GitHub issues (shadcn #3843), Supabase RLS docs, existing PITFALLS.md research
- Mobile patterns: HIGH - Apple HIG and WCAG standards are authoritative sources
- Markdown vs plain text: MEDIUM - User preference unclear, both options viable
- Optimistic updates: MEDIUM - React 19 feature, well-documented but less battle-tested than RHF

**Research date:** 2026-02-16
**Valid until:** ~30 days (stable stack, minor version updates possible)

**Key risks mitigated:**
- Dialog validation issues (known bug, documented workaround)
- RLS policy gaps (explicitly check INSERT/UPDATE policies)
- Mobile UX (44x44px touch targets mandatory)
- Double-submission (loading states + disabled buttons)
- Soft delete filtering (must add `is_active = true` to queries)

**Integration with existing codebase:**
- Follows v1.1 pattern: Supabase client-side queries, no server actions
- Follows v1.2 pattern: Dialog-based forms, inline edit mode
- Reuses Phase 14: NicheComboBox, scripts table schema, RLS policies
- Consistent with STACK-v1.4.md: React Hook Form + Zod already specified as standard
