# Phase 6: CTA Optimization - Research

**Researched:** 2026-01-28
**Domain:** Landing page CTA design, mobile UX, conversion optimization
**Confidence:** HIGH

## Summary

This research covers three interconnected CTA optimization requirements for the NSPC Valentine's Day landing page: button hierarchy, sticky mobile CTA bar, and urgency messaging. The existing `MetalButton` component provides a solid foundation with gold/silver variants using gradient styling. The research identified clear patterns for extending this into a proper primary/secondary hierarchy while adding scroll-triggered mobile CTAs and strategic urgency elements.

The standard approach is to enhance the existing MetalButton with additional variants (primary gold filled, secondary outlined), implement a scroll-triggered sticky bar using Intersection Observer, and add subtle urgency badges near CTAs. The project already has animation infrastructure (fadeSlideUp, ease-spring, reduced-motion support) that can be extended.

**Primary recommendation:** Extend MetalButton with hover/active/focus state polish and add a new StickyMobileCTA component that appears when the hero scrolls out of view.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 3.x | Styling (already in project) | Standard for utility-first CSS with state variants |
| react-intersection-observer | 9.x | Scroll-triggered visibility | Lightweight, React-idiomatic IntersectionObserver wrapper |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native CSS env() | N/A | Safe area insets for notched devices | Always for fixed bottom bars |
| CSS @keyframes | N/A | Pulse/glow animations | Urgency badges, subtle attention |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-intersection-observer | Native IntersectionObserver | More boilerplate, but zero dependencies |
| CSS animations | Framer Motion | Overkill for simple pulse effects; already used in project so could leverage |

**Installation:**
```bash
npm install react-intersection-observer
```

Note: The project may already have this or could use native IntersectionObserver. Check `package.json` before adding.

## Architecture Patterns

### Recommended Component Structure
```
components/
├── ui/
│   └── metal-button.tsx      # Enhanced with primary/secondary/ghost variants
├── sticky-mobile-cta.tsx     # New: scroll-triggered bottom bar
└── urgency-badge.tsx         # New: "Limited seating" pills
```

### Pattern 1: Button Hierarchy via Variant Prop

**What:** Extend MetalButton with clear visual hierarchy (primary = filled gold, secondary = outlined, ghost = text-only)

**When to use:** Primary for main conversion action, secondary for alternative actions, ghost for tertiary/dismissive

**Example:**
```typescript
// Source: Tailwind docs + existing MetalButton patterns
interface MetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "lg";
}

const variantStyles = {
  primary: `
    bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700
    text-yellow-950
    shadow-[0_2px_8px_rgba(212,168,67,0.5)]
    hover:from-yellow-200 hover:via-yellow-400 hover:to-yellow-600
    hover:shadow-[0_4px_12px_rgba(212,168,67,0.6)]
    hover:scale-[1.02]
    active:scale-[0.98]
    focus:outline-none focus:ring-2 focus:ring-valentine-gold focus:ring-offset-2
  `,
  secondary: `
    bg-transparent
    text-valentine-gold
    border-2 border-valentine-gold
    hover:bg-valentine-gold/10
    hover:border-valentine-gold-light
    active:scale-[0.98]
    focus:outline-none focus:ring-2 focus:ring-valentine-gold focus:ring-offset-2
  `,
  ghost: `
    bg-transparent
    text-valentine-red
    hover:text-valentine-red-light
    hover:underline
    active:scale-[0.98]
    focus:outline-none focus:ring-2 focus:ring-valentine-red/50
  `,
};
```

### Pattern 2: Sticky Bottom CTA with Intersection Observer

**What:** Fixed bottom bar that appears when user scrolls past hero section

**When to use:** Mobile-first, but can show on desktop if desired

**Example:**
```typescript
// Source: react-intersection-observer docs + MDN safe-area-inset
"use client";

import { useInView } from "react-intersection-observer";
import { MetalButton } from "@/components/ui/metal-button";

function StickyMobileCTA({ onReserveClick }: { onReserveClick: () => void }) {
  // Track when hero is OUT of view (trigger sticky bar)
  const { ref: heroSentinel, inView: heroVisible } = useInView({
    threshold: 0,
  });

  return (
    <>
      {/* Invisible sentinel placed at bottom of hero */}
      <div ref={heroSentinel} className="h-0 w-full" aria-hidden="true" />

      {/* Sticky bar - appears when hero scrolls away */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-40
          bg-valentine-red/95 backdrop-blur-sm
          border-t border-valentine-gold/30
          px-4 py-3
          pb-[calc(0.75rem+env(safe-area-inset-bottom))]
          transform transition-transform duration-300 ease-spring
          md:hidden
          ${heroVisible ? "translate-y-full" : "translate-y-0"}
        `}
        role="region"
        aria-label="Quick reservation"
      >
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <span className="text-white text-sm font-medium">
            Limited Valentine's seating
          </span>
          <MetalButton variant="primary" size="sm" onClick={onReserveClick}>
            Reserve Now
          </MetalButton>
        </div>
      </div>
    </>
  );
}
```

### Pattern 3: Urgency Badge Component

**What:** Small pill/badge with scarcity or time-sensitive messaging

**When to use:** Adjacent to CTAs, in hero, or in sticky bar

**Example:**
```typescript
// Source: Conversion optimization patterns
interface UrgencyBadgeProps {
  children: React.ReactNode;
  pulse?: boolean;
}

function UrgencyBadge({ children, pulse = false }: UrgencyBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        bg-valentine-red text-white
        text-xs font-semibold uppercase tracking-wide
        px-3 py-1 rounded-full
        ${pulse ? "animate-pulse-subtle" : ""}
      `}
    >
      <span className="w-1.5 h-1.5 bg-valentine-gold rounded-full" />
      {children}
    </span>
  );
}

// Add to globals.css:
// @keyframes pulse-subtle {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.85; }
// }
// .animate-pulse-subtle {
//   animation: pulse-subtle 2s ease-in-out infinite;
// }
```

### Anti-Patterns to Avoid

- **Over-animating CTAs:** Aggressive pulsing or shaking repels users. Keep animations subtle (opacity, small scale).
- **Fake scarcity:** "Only 3 spots left!" when there are 50. Damages trust. Use honest messaging.
- **Multiple competing primary CTAs:** Visual hierarchy breaks down. One primary CTA per viewport.
- **Sticky bar blocking content:** Ensure adequate bottom padding on page content.
- **Ignoring safe-area-inset:** Bottom bars get clipped by iPhone home indicator.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll position detection | `window.scroll` event listeners | IntersectionObserver / react-intersection-observer | Performant, async, no layout thrashing |
| Notch-safe padding | Manual pixel values | `env(safe-area-inset-bottom)` | Automatically adapts to device |
| Button focus rings | Custom focus styles | Tailwind `focus:ring-*` utilities | Consistent, accessible, tested |
| Reduced motion handling | Inline conditionals | `motion-safe:` / `motion-reduce:` Tailwind variants + CSS media query | System-level preference respected |

**Key insight:** Scroll-triggered UI is a solved problem. IntersectionObserver is universally supported and more efficient than scroll event listeners.

## Common Pitfalls

### Pitfall 1: Sticky Bar Z-Index Conflicts

**What goes wrong:** Sticky bar appears behind modals or other overlays
**Why it happens:** Z-index stacking context confusion
**How to avoid:** Use consistent z-index scale (modal=50, sticky=40, header=30)
**Warning signs:** Bar flickers or disappears when modal opens

### Pitfall 2: Touch Target Too Small on Mobile

**What goes wrong:** Users tap wrong button or miss entirely
**Why it happens:** Visual button smaller than 44x44px touch area
**How to avoid:** Ensure min-height/min-width of 44px, add padding if visual is smaller
**Warning signs:** Analytics show rage taps, low mobile conversion

### Pitfall 3: Safe Area Not Applied

**What goes wrong:** Content hidden behind iPhone home indicator
**Why it happens:** Forgot `env(safe-area-inset-bottom)` or no `viewport-fit=cover`
**How to avoid:** Always add safe-area padding to fixed bottom elements
**Warning signs:** iPhone X+ users report cut-off buttons

### Pitfall 4: Urgency Messaging Fatigue

**What goes wrong:** Users ignore or distrust urgency cues
**Why it happens:** Overuse, fake scarcity, or aggressive language
**How to avoid:** One clear urgency message, keep it honest ("Reservations close Feb 10")
**Warning signs:** Bounce rate increases, social media complaints

### Pitfall 5: Sticky Bar on Desktop Feels Intrusive

**What goes wrong:** Desktop users annoyed by persistent bottom bar
**Why it happens:** Applied same pattern across all viewports
**How to avoid:** Hide on desktop (`md:hidden`) or use less intrusive treatment
**Warning signs:** Desktop conversion drops after sticky bar added

## Code Examples

Verified patterns from official sources:

### Button State Transitions (Tailwind)
```typescript
// Source: https://tailwindcss.com/docs/hover-focus-and-other-states
// Comprehensive button with all interactive states
<button className="
  px-6 py-3 rounded-md font-bold uppercase tracking-wider
  bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700
  text-yellow-950
  shadow-[0_2px_8px_rgba(212,168,67,0.5)]
  border border-white/20

  /* Hover: lighten gradient, increase shadow, slight scale */
  hover:from-yellow-200 hover:via-yellow-400 hover:to-yellow-600
  hover:shadow-[0_4px_16px_rgba(212,168,67,0.7)]
  hover:scale-[1.02]

  /* Active: press down effect */
  active:scale-[0.98]
  active:shadow-[0_1px_4px_rgba(212,168,67,0.4)]

  /* Focus: visible ring for keyboard navigation */
  focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2
  focus-visible:ring-2

  /* Disabled state */
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100

  /* Transitions */
  transition-all duration-200

  /* Reduced motion preference */
  motion-reduce:transition-none motion-reduce:hover:scale-100
">
  Reserve Now
</button>
```

### Intersection Observer Setup (Native Alternative)
```typescript
// Source: MDN IntersectionObserver + David Walsh sticky detection
// If you prefer not adding react-intersection-observer package

import { useEffect, useState, useRef } from "react";

function useScrolledPastHero() {
  const [isPastHero, setIsPastHero] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is NOT intersecting, user has scrolled past hero
        setIsPastHero(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, isPastHero };
}
```

### Safe Area Padding for Bottom Bar
```css
/* Source: MDN env() + CSS-Tricks notch article */
/* Add to globals.css or component styles */

.sticky-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;

  /* Base padding */
  padding: 0.75rem 1rem;

  /* Add safe area inset for notched devices */
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
}

/* Ensure viewport-fit in document head:
   <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
*/
```

### Screen Reader Announcement for Sticky Bar
```typescript
// Source: MDN aria-live + Deque accessibility tips
// Announce sticky bar appearance to screen readers

function StickyMobileCTA({ visible, onReserveClick }) {
  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {visible ? "Quick reservation bar is now available at bottom of screen" : ""}
      </div>

      <div
        className={`fixed bottom-0 ... ${visible ? "translate-y-0" : "translate-y-full"}`}
        aria-hidden={!visible}
      >
        {/* ... bar content ... */}
      </div>
    </>
  );
}
```

## Accessibility Requirements

### Touch Target Sizing
- **WCAG 2.5.5 (AAA):** 44x44 CSS pixels minimum
- **WCAG 2.5.8 (AA):** 24x24 CSS pixels minimum
- **Recommendation:** Target 44x44 for all CTA buttons, especially on mobile

### Focus States
- All interactive elements MUST have visible focus indicators
- Use `focus-visible` to avoid showing focus ring on mouse click
- Ring should have sufficient contrast (3:1 against adjacent colors)

### Reduced Motion
- Project already has `@media (prefers-reduced-motion: reduce)` in globals.css
- Extend to cover new animations:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-subtle {
    animation: none;
  }
  .sticky-bottom-bar {
    transition: none;
  }
}
```

### Screen Reader Considerations
- Sticky bar should have `role="region"` and `aria-label`
- Appearance should be announced via aria-live region (polite, not assertive)
- When bar is hidden, use `aria-hidden="true"` to remove from accessibility tree

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scroll event listeners | IntersectionObserver | 2019+ | 10x more performant, no layout thrashing |
| Fixed pixel padding for notch | env(safe-area-inset-*) | 2018+ (iOS 11) | Automatically adapts to all devices |
| :focus pseudo-class | :focus-visible | 2021+ | Better UX - no focus ring on click |
| Single hover state | hover + active + focus states | Always | Complete interaction feedback |

**Current best practice (2026):**
- IntersectionObserver is universally supported (97%+ browsers)
- env() safe-area values supported on all modern mobile browsers
- focus-visible has excellent support, progressive enhancement for older browsers

## Open Questions

Things that couldn't be fully resolved:

1. **Should sticky bar show on desktop?**
   - What we know: Mobile patterns are clear (sticky bottom bar), desktop is more varied
   - What's unclear: Whether NSPC desktop users would benefit or find it intrusive
   - Recommendation: Start with mobile-only (`md:hidden`), A/B test desktop later

2. **Exact urgency message copy**
   - What we know: Honest scarcity works better than fake urgency
   - What's unclear: What's the actual booking situation? Seats available? Deadline?
   - Recommendation: Use date-based urgency ("Reserve by Feb 10") unless real-time availability exists

3. **MetalButton replacement vs enhancement**
   - What we know: Current component works, just needs state polish
   - What's unclear: Whether to keep gold/silver variants or switch to primary/secondary naming
   - Recommendation: Add primary/secondary/ghost as new variants, keep gold/silver for backward compat during transition, then deprecate

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS - Hover, Focus, and Other States](https://tailwindcss.com/docs/hover-focus-and-other-states) - Official state variant documentation
- [Tailwind CSS - Transitions](https://tailwindcss.com/docs/transition-property) - Animation utilities
- [MDN - env() CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env) - Safe area insets
- [W3C WCAG 2.5.5 - Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) - Accessibility requirements
- [MDN - aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) - Screen reader announcements

### Secondary (MEDIUM confidence)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer) - useInView hook documentation
- [David Walsh - Detect Sticky Element](https://davidwalsh.name/detect-sticky) - IntersectionObserver sticky detection pattern
- [CSS-Tricks - The Notch and CSS](https://css-tricks.com/the-notch-and-css/) - Safe area implementation guide
- [LandingPageFlow - CTA Placement 2026](https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages) - Current CTA placement strategies

### Tertiary (LOW confidence - needs validation)
- [GoHighLevel - Loss Aversion CTAs](https://blog.gohighlevel.com/loss-aversion-and-scarcity-based-ctas-for-landing-page/) - Urgency psychology patterns
- [VenureHarbour - Urgency Landing Pages](https://ventureharbour.com/add-urgency-to-your-landing-pages-with-examples/) - Urgency implementation examples

## Metadata

**Confidence breakdown:**
- Button hierarchy: HIGH - Official Tailwind docs, well-established patterns
- Sticky bar: HIGH - IntersectionObserver well-documented, safe-area widely supported
- Urgency patterns: MEDIUM - Psychology patterns established, specific implementation varies
- Accessibility: HIGH - WCAG specifications are authoritative

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable patterns)
