# Phase 5: Menu Card Refinement - Research

**Researched:** 2026-01-28
**Domain:** CSS animations, Tailwind utility patterns, card styling
**Confidence:** HIGH

## Summary

This research covers four areas for the NSPC Valentine's Day landing page menu card refinement: polished card styling, smooth expand/collapse transitions, refined typography, and visual differentiation between the two menu options.

The current implementation in `split-decision.tsx` uses basic card styling with `rounded-2xl border-2 border-valentine-gold/30` and conditional rendering for expand/collapse (no animation). The existing codebase already has `fadeSlideUp` keyframes in `globals.css` and respects `prefers-reduced-motion`.

**Primary recommendation:** Use CSS grid-rows animation for height transitions, combine shadow + ring utilities for premium card feel, differentiate options via left-border accent colors using existing theme colors.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 3.x (existing) | Utility-first styling | Already in project, extensive shadow/ring/transition utilities |
| CSS Custom Properties | Native | Theme colors | Already defined in globals.css |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS grid-template-rows | Native CSS | Height animation | Animate height 0 to auto without JS |
| CSS cubic-bezier | Native CSS | Spring easing | Create bounce/elastic feel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| grid-rows animation | max-height hack | max-height requires guessing max value, causes delay on short content |
| CSS cubic-bezier spring | linear() function | Better spring physics but browser support slightly newer |
| Tailwind shadow classes | Custom box-shadow | Custom allows more control but standard classes are consistent |

**Installation:**
No additional packages needed - all patterns use existing Tailwind utilities and CSS.

## Architecture Patterns

### Current Structure (for context)
```
split-decision.tsx
├── Lines 84-100: Expanded menu panel (conditional render, no animation)
├── Lines 103-121: Comparison cards (side-by-side, basic styling)
└── Uses: menuOptions from lib/menu-data.ts
```

### Pattern 1: Grid-Rows Height Animation
**What:** Animate height from 0 to auto using CSS grid fractional units
**When to use:** Any expand/collapse content where height is unknown
**Example:**
```tsx
// Source: https://github.com/tailwindlabs/tailwindcss/discussions/11186
// Parent wrapper - controls height via grid-template-rows
<div className={`grid ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} transition-[grid-template-rows] duration-500`}>
  {/* Child - MUST have overflow-hidden */}
  <div className="overflow-hidden">
    {/* Actual content */}
    <div className="p-8">
      Content here
    </div>
  </div>
</div>
```

**Key requirements:**
- Parent must be `display: grid`
- Toggle between `grid-rows-[0fr]` and `grid-rows-[1fr]`
- Direct child MUST have `overflow-hidden`
- Actual content can be nested inside the overflow wrapper

### Pattern 2: Spring Easing via Cubic-Bezier
**What:** Create bouncy/elastic feel using cubic-bezier with overshooting values
**When to use:** Interactive elements where playful feedback improves UX
**Example:**
```css
/* Source: https://css-tricks.com/almanac/functions/c/cubic-bezier/ */
/* Subtle spring - overshoots slightly then settles */
transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);

/* More pronounced spring */
transition-timing-function: cubic-bezier(0.68, -0.6, 0.32, 1.6);
```

**In Tailwind (arbitrary value):**
```tsx
className="transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
```

### Pattern 3: Premium Card Styling Stack
**What:** Layer shadow, ring, and border for premium depth
**When to use:** Important content cards that need visual prominence
**Example:**
```tsx
// Source: https://tailwindcss.com/docs/box-shadow
// Base state
<div className="
  bg-valentine-cream
  rounded-2xl
  shadow-md
  ring-1 ring-valentine-gold/20
  border-l-4 border-valentine-red
  transition-all duration-300
  hover:shadow-lg hover:ring-valentine-gold/40
">
```

### Pattern 4: Visual Differentiation via Border Accent
**What:** Use left border color to distinguish two related cards
**When to use:** Side-by-side comparison where cards are similar but distinct
**Example:**
```tsx
// Option 1 card - uses primary red
<div className="border-l-4 border-valentine-red bg-valentine-cream">

// Option 2 card - uses lighter red for subtle differentiation
<div className="border-l-4 border-valentine-red-light bg-valentine-cream">
```

**Alternative: Background tint**
```tsx
// Option 1 - warmer cream
<div className="bg-valentine-cream">

// Option 2 - pinker tint
<div className="bg-valentine-pink-light/30">
```

### Anti-Patterns to Avoid
- **Conditional rendering for expand/collapse:** Causes content to pop in/out without animation. Use CSS height animation instead.
- **max-height: 1000px trick:** Requires guessing, creates delay proportional to gap between actual and max height.
- **Color as only differentiator:** Accessibility issue - always pair with text labels or position.
- **Excessive shadow stacking:** More than shadow + ring looks heavy. Pick one strong elevation.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Height animation | `style={{ height: isOpen ? ref.scrollHeight : 0 }}` | grid-rows-[0fr]/[1fr] | No JS measurement, smoother, handles dynamic content |
| Spring easing | `requestAnimationFrame` spring simulation | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Pure CSS, no JS overhead |
| Card shadows | Custom box-shadow values | `shadow-md`, `shadow-lg`, etc. | Consistent with design system, well-tested values |
| Focus rings | `outline: 2px solid` | `ring-2 ring-offset-2` | Handles background colors, consistent sizing |

**Key insight:** Tailwind v3+ has mature utilities for all these patterns. The grid-rows technique is particularly valuable because animating `height: auto` has been a CSS pain point for years, and this is the cleanest CSS-only solution.

## Common Pitfalls

### Pitfall 1: Missing overflow-hidden on grid-rows child
**What goes wrong:** Content visible even when collapsed (0fr)
**Why it happens:** Grid item still has intrinsic height, just fractional allocation is 0
**How to avoid:** Always wrap content in `<div className="overflow-hidden">` as direct child of grid container
**Warning signs:** Content bleeds out during collapse animation

### Pitfall 2: Transitioning grid-template-rows vs grid-rows
**What goes wrong:** No animation, instant state change
**Why it happens:** Transitioning wrong property name
**How to avoid:** Use `transition-[grid-template-rows]` (the full property name)
**Warning signs:** Content jumps without smooth transition

### Pitfall 3: Spring easing on long durations
**What goes wrong:** Animation feels slow and draggy despite "spring" curve
**Why it happens:** Spring physics are time-dependent; 500ms+ feels wrong
**How to avoid:** Keep spring animations 300-500ms max; use ease-out for longer durations
**Warning signs:** Animation feels sluggish despite overshooting

### Pitfall 4: Forgetting prefers-reduced-motion
**What goes wrong:** Vestibular/motion-sensitive users get nauseated
**Why it happens:** Animations added without accessibility consideration
**How to avoid:** Wrap spring/bounce animations in `motion-safe:` variant or add CSS media query
**Warning signs:** WCAG compliance failures, user complaints

### Pitfall 5: Color-only differentiation
**What goes wrong:** Red-green colorblind users cannot distinguish options
**Why it happens:** Relying solely on valentine-red vs valentine-red-light
**How to avoid:** Add text labels, position labels, or border position differences
**Warning signs:** Users confuse Option 1 and Option 2

## Code Examples

Verified patterns from official sources:

### Complete Expand/Collapse Component
```tsx
// Pattern verified via: https://github.com/tailwindlabs/tailwindcss/discussions/11186
interface ExpandableMenuProps {
  isExpanded: boolean;
  title: string;
  courses: { label: string; item: string }[];
  accentColor?: 'red' | 'red-light';
}

function ExpandableMenu({ isExpanded, title, courses, accentColor = 'red' }: ExpandableMenuProps) {
  const borderColor = accentColor === 'red'
    ? 'border-valentine-red'
    : 'border-valentine-red-light';

  return (
    <div
      className={`
        grid
        ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
        transition-[grid-template-rows]
        duration-500
        ease-[cubic-bezier(0.34,1.56,0.64,1)]
        motion-reduce:transition-none
      `}
    >
      <div className="overflow-hidden">
        <div className={`
          bg-valentine-cream
          rounded-2xl
          shadow-md
          ring-1 ring-valentine-gold/20
          border-l-4 ${borderColor}
          p-8
        `}>
          <h3 className="font-[family-name:var(--font-playfair)] text-valentine-red text-2xl font-bold mb-6 text-center">
            {title}
          </h3>
          <div className="space-y-4">
            {courses.map((course, idx) => (
              <div key={idx} className="border-b border-valentine-gold/20 pb-3 last:border-0">
                <p className="text-valentine-red/50 text-xs uppercase tracking-widest font-semibold">
                  {course.label}
                </p>
                <p className="text-valentine-red text-lg mt-1 leading-relaxed">
                  {course.item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Card Hover State Pattern
```tsx
// Source: https://tailwindcss.com/docs/hover-focus-and-other-states
<div className="
  bg-valentine-cream
  rounded-2xl
  shadow-sm
  ring-1 ring-valentine-gold/10
  border-l-4 border-valentine-red
  p-6
  transition-all duration-300 ease-out
  hover:shadow-lg
  hover:ring-valentine-gold/30
  hover:-translate-y-1
  active:translate-y-0
  active:shadow-md
">
```

### Typography Hierarchy for Course Items
```tsx
// Source: https://tailwindcss.com/docs/font-weight, https://tailwindcss.com/docs/letter-spacing
<div className="border-b border-valentine-gold/20 pb-4 last:border-0 last:pb-0">
  {/* Label - small, uppercase, spaced out, muted */}
  <p className="text-valentine-red/50 text-xs uppercase tracking-widest font-semibold mb-1">
    {course.label}
  </p>
  {/* Item - larger, normal case, full color, relaxed line-height */}
  <p className="text-valentine-red text-base md:text-lg leading-relaxed">
    {course.item}
  </p>
</div>
```

### Accessible Toggle Button
```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded
<button
  onClick={() => setExpandedId(expandedId === option.id ? null : option.id)}
  aria-expanded={expandedId === option.id}
  aria-controls={`menu-panel-${option.id}`}
  className="text-valentine-pink-light text-sm underline hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-valentine-gold/50 rounded"
>
  {expandedId === option.id ? "Hide menu" : option.prompt}
</button>

{/* Panel with matching id */}
<div id={`menu-panel-${option.id}`}>
  {/* expandable content */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `max-height: 9999px` | `grid-rows-[0fr]/[1fr]` | CSS Grid Level 2 | Clean height animation without guessing values |
| JavaScript spring libraries | `cubic-bezier` with >1 values | CSS3 (long supported) | No JS, better performance |
| Custom shadow values | Tailwind `shadow-*` scale | Tailwind v3 | Consistent, predictable elevation |
| `outline` for focus | `ring-*` utilities | Tailwind v2+ | Better control, offset support |
| `ease-in-out` everywhere | `ease-out` for UI, spring for playful | UX best practice | More natural feel |

**Deprecated/outdated:**
- jQuery's `slideDown()/slideUp()`: Pure CSS achieves same effect now
- `height: calc()` with JS measurement: grid-rows eliminates need
- CSS `transition: all`: Too broad, can cause layout thrashing. Prefer `transition-[specific-property]`

## Open Questions

Things that couldn't be fully resolved:

1. **linear() easing function browser support**
   - What we know: Modern browsers support it, enables true spring physics
   - What's unclear: Safari support level, fallback behavior
   - Recommendation: Stick with cubic-bezier for this project; linear() is nice-to-have

2. **Animation performance on low-end mobile**
   - What we know: CSS animations generally performant
   - What's unclear: grid-rows animation compositor layer behavior
   - Recommendation: Keep `will-change: auto` (default), test on real devices

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS Box Shadow Documentation](https://tailwindcss.com/docs/box-shadow) - shadow utility values
- [Tailwind CSS Ring Width Documentation](https://tailwindcss.com/docs/ring-width) - ring utility patterns
- [Tailwind CSS Hover States Documentation](https://tailwindcss.com/docs/hover-focus-and-other-states) - state variants
- [MDN aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded) - accessibility attributes

### Secondary (MEDIUM confidence)
- [Tailwind GitHub Discussion #11186](https://github.com/tailwindlabs/tailwindcss/discussions/11186) - grid-rows height animation pattern, verified with multiple implementations
- [CSS-Tricks cubic-bezier()](https://css-tricks.com/almanac/functions/c/cubic-bezier/) - spring easing values
- [Josh Comeau linear() function](https://www.joshwcomeau.com/animation/linear-timing-function/) - spring animation theory

### Tertiary (LOW confidence)
- None - all patterns verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing Tailwind, verified patterns
- Architecture (grid-rows animation): HIGH - documented in Tailwind GitHub, widely adopted
- Architecture (spring easing): MEDIUM - values work but "feel" is subjective
- Pitfalls: HIGH - based on documented issues and best practices
- Typography: HIGH - standard Tailwind utility combinations

**Research date:** 2026-01-28
**Valid until:** 60 days (Tailwind CSS is stable; patterns unlikely to change)
