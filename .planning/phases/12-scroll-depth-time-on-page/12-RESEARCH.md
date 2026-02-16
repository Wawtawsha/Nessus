# Phase 12: Scroll Depth + Explicit Time on Page - Research

**Researched:** 2026-02-15
**Domain:** Scroll depth tracking, heartbeat-based time-on-page, web analytics enhancement
**Confidence:** MEDIUM-HIGH

## Summary

Phase 12 adds scroll depth analytics and enhances time-on-page measurement with explicit tracking. Research reveals this phase has TWO distinct parts: (1) **tracking implementation** on the Shrike website to capture new data, and (2) **analytics visualization** in the CRM dashboard.

Current tracking (useNessusTracking.ts) sends only page views and custom events. Scroll depth requires NEW tracking: events fired at scroll milestones (25%, 50%, 75%, 90%, 100%). Enhanced time-on-page requires heartbeat/ping events sent periodically (every 10-15s) to measure engagement time even on last pages.

The standard approach is IntersectionObserver API for scroll tracking (more performant than scroll event listeners) and Page Visibility API for heartbeat pausing when tab is backgrounded. Both store data in existing event_data JSONB column — no schema changes needed.

Visualization follows the established section component pattern: new ScrollDepth.tsx section showing per-page scroll milestone achievement, and enhancement to existing TimeOnPage.tsx to incorporate heartbeat data for more accurate metrics.

**Primary recommendation:** Implement scroll depth with IntersectionObserver + custom events first (simpler, immediate value). Defer heartbeat tracking to separate phase — it requires Page Visibility API, interval timers, and more complex state management. Split into 12-01 (scroll depth) and potential 12-02 (heartbeat) plans.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| IntersectionObserver API | Native (96%+ support 2026) | Scroll milestone detection | More performant than scroll listeners, runs off main thread, no throttling needed |
| Page Visibility API | Native (98%+ support 2026) | Tab visibility detection | Pauses heartbeats when tab backgrounded, prevents wasted pings |
| React | 18.2.0 | UI framework | Already in use for section components |
| date-fns | 4.1.0 | Time formatting | Already installed, used in TimeOnPage.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lodash.throttle | 4.1.1 | Event rate limiting | ONLY if using scroll listeners instead of IntersectionObserver (fallback) |
| sessionStorage API | Native | Max scroll tracking | Persist max scroll per page during session, avoid duplicate milestone events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IntersectionObserver | addEventListener('scroll') + throttle | Scroll listeners run on main thread, require throttling, 43% more CPU on slow devices |
| Custom tracking | GA4 Enhanced Measurement | GA4 only tracks 90% by default, requires GTM for custom thresholds, vendor lock-in |
| Event-based heartbeat | requestIdleCallback intervals | IdleCallback may delay too much, not predictable for analytics |
| Single event + parameter | Multiple event names (scroll_25, scroll_50) | Parameter approach needs custom dimension registration, less visible in raw data |

**Installation:**
```bash
# No new packages required - using native browser APIs
# IntersectionObserver and Page Visibility API are built-in
```

## Architecture Patterns

### Recommended Project Structure
```
shrike/hooks/
└── useNessusTracking.ts        # ENHANCE - add scroll and heartbeat tracking

crm-dashboard/components/sections/
├── ScrollDepth.tsx             # NEW - scroll milestone analytics
├── TimeOnPage.tsx              # ENHANCE - incorporate heartbeat data
└── [10 existing sections]

crm-dashboard/components/shared/
└── types.ts                    # EXISTING - event_data already JSONB, no schema change
```

### Pattern 1: IntersectionObserver Scroll Depth Tracking
**What:** Detect when user scrolls past specific page depth milestones (25%, 50%, 75%, 90%, 100%)
**When to use:** Measuring content consumption, identifying drop-off points
**Example:**
```typescript
// Source: IntersectionObserver best practices + scroll depth research
useEffect(() => {
  const milestones = [25, 50, 75, 90, 100]
  const observers: IntersectionObserver[] = []
  const fired = new Set<number>() // Prevent duplicate fires

  milestones.forEach((percent) => {
    // Create sentinel element at scroll depth
    const sentinel = document.createElement('div')
    sentinel.style.position = 'absolute'
    sentinel.style.top = `${percent}%`
    sentinel.style.height = '1px'
    sentinel.style.width = '100%'
    sentinel.style.pointerEvents = 'none'
    document.body.appendChild(sentinel)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !fired.has(percent)) {
            fired.add(percent)
            trackEvent('scroll_depth', {
              percent_scrolled: percent,
              page_path: window.location.pathname
            })
          }
        })
      },
      { threshold: 0 }
    )

    observer.observe(sentinel)
    observers.push(observer)
  })

  return () => {
    observers.forEach((obs) => obs.disconnect())
    // Clean up sentinel elements
  }
}, [])
```

### Pattern 2: Heartbeat Event Tracking with Page Visibility
**What:** Send periodic ping events every 10-15s while page is visible to measure active engagement time
**When to use:** Capturing time-on-page for last page in session, measuring active vs passive time
**Example:**
```typescript
// Source: Matomo heartbeat FAQ + Page Visibility API best practices
useEffect(() => {
  let intervalId: NodeJS.Timeout | null = null
  let startTime = Date.now()
  let accumulatedTime = 0

  const sendHeartbeat = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    trackEvent('heartbeat', {
      time_on_page: accumulatedTime + elapsed,
      page_path: window.location.pathname
    })
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause heartbeat when tab backgrounded
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
        accumulatedTime += Math.floor((Date.now() - startTime) / 1000)
      }
    } else {
      // Resume heartbeat when tab visible again
      startTime = Date.now()
      if (!intervalId) {
        intervalId = setInterval(sendHeartbeat, 15000) // 15s intervals
      }
    }
  }

  // Start heartbeat
  intervalId = setInterval(sendHeartbeat, 15000)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    if (intervalId) clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    // Send final heartbeat on unmount
    sendHeartbeat()
  }
}, [pagePath])
```

### Pattern 3: Scroll Depth Analytics Section Component
**What:** Section component showing per-page scroll milestone achievement rates
**When to use:** Understanding which pages keep users engaged, where users drop off
**Example:**
```typescript
// Source: Established section component pattern from Phase 9-11
export function ScrollDepth({ visits }: { visits: Visit[] }) {
  const scrollStats = useMemo(() => {
    // Filter for scroll_depth events
    const scrollEvents = visits.filter(
      (v) => v.event_name === 'scroll_depth' && v.event_data?.percent_scrolled
    )

    // Group by page_path
    const pageScrolls = new Map<string, { milestones: number[], pageViews: number }>()

    scrollEvents.forEach((event) => {
      const page = event.page_path || 'Unknown'
      const percent = event.event_data.percent_scrolled

      if (!pageScrolls.has(page)) {
        pageScrolls.set(page, { milestones: [], pageViews: 0 })
      }
      pageScrolls.get(page)!.milestones.push(percent)
    })

    // Count page views per page
    visits
      .filter((v) => !v.event_name && v.page_path)
      .forEach((v) => {
        if (pageScrolls.has(v.page_path!)) {
          pageScrolls.get(v.page_path!)!.pageViews++
        }
      })

    // Calculate achievement rates
    return Array.from(pageScrolls.entries()).map(([page, data]) => {
      const total = data.pageViews
      const reached25 = data.milestones.filter(p => p >= 25).length
      const reached50 = data.milestones.filter(p => p >= 50).length
      const reached75 = data.milestones.filter(p => p >= 75).length
      const reached100 = data.milestones.filter(p => p === 100).length

      return {
        page,
        total,
        rates: {
          '25%': (reached25 / total) * 100,
          '50%': (reached50 / total) * 100,
          '75%': (reached75 / total) * 100,
          '100%': (reached100 / total) * 100,
        }
      }
    })
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scroll Depth</h2>
      {/* Render scroll achievement rates per page */}
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Don't use scroll event listeners without passive flag** - Causes scroll jank, blocks main thread. Use IntersectionObserver or passive: true.
- **Don't fire scroll events continuously** - Track only on milestone achievement, use Set to prevent duplicates.
- **Don't send heartbeats when tab hidden** - Inflates time metrics. Use Page Visibility API to pause intervals.
- **Don't calculate scroll % with scrollTop alone** - Viewport height varies. Use `(scrollTop + innerHeight) / scrollHeight * 100`.
- **Don't forget cleanup** - IntersectionObserver.disconnect() and clearInterval() on unmount to prevent memory leaks.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll percentage calculation | Manual scrollTop / scrollHeight math | IntersectionObserver with sentinel elements | Handles viewport size, dynamic content, fractional pixels correctly |
| Event throttling/debouncing | Custom setTimeout logic | lodash.throttle OR passive listeners + IntersectionObserver | Throttle has edge cases (leading/trailing), passive listeners eliminate need |
| Tab visibility detection | focus/blur window events | Page Visibility API (document.hidden) | Focus/blur miss minimized windows, alt-tab cases |
| Max scroll persistence | Custom state management | sessionStorage with page key | Survives re-renders, already built-in, cleared on session end |
| Time accumulation across pauses | Manual interval tracking | Accumulator pattern with visibility events | Edge cases: rapid tab switches, system sleep |

**Key insight:** Modern browser APIs (IntersectionObserver, Page Visibility) eliminate the need for complex event listener management, throttling, and performance optimization. Use native APIs over custom solutions.

## Common Pitfalls

### Pitfall 1: Duplicate Scroll Milestone Events
**What goes wrong:** Same milestone fires multiple times as user scrolls up/down past threshold.
**Why it happens:** IntersectionObserver fires on BOTH entering and leaving viewport.
**How to avoid:**
- Use a Set to track which milestones have fired: `const fired = new Set<number>()`
- Check `!fired.has(percent)` before tracking, add to Set after
- Alternative: Store max scroll in sessionStorage, only fire if new max
**Warning signs:** Event counts for scroll_25 exceed page view counts

### Pitfall 2: Scroll Depth % Calculation Off-Screen
**What goes wrong:** Scroll percentages calculated incorrectly for pages with dynamic content (lazy-loaded images, accordions).
**Why it happens:** `document.documentElement.scrollHeight` changes as content loads, sentinel elements positioned at wrong depths.
**How to avoid:**
- Recalculate sentinel positions on window resize or use CSS percentage positioning
- Wait for images/content to load before setting up observers (window.onload vs DOMContentLoaded)
- Use `position: absolute` on sentinels with `top: X%` relative to body height
**Warning signs:** 100% milestone fires when page appears half-scrolled

### Pitfall 3: Heartbeat Intervals Continue When Tab Hidden
**What goes wrong:** Heartbeat events sent while tab is backgrounded, inflating time-on-page metrics.
**Why it happens:** setInterval continues running when tab loses focus unless explicitly paused.
**How to avoid:**
- Listen to `visibilitychange` event
- Clear interval when `document.hidden === true`
- Restart interval when `document.hidden === false`
- Accumulate time before pause: `accumulatedTime += (now - startTime)`
**Warning signs:** Average time-on-page exceeds realistic reading time

### Pitfall 4: Memory Leaks from Undisconnected Observers
**What goes wrong:** IntersectionObserver instances and sentinel DOM elements persist after component unmount.
**Why it happens:** Observers not disconnected in cleanup, sentinel elements not removed from DOM.
**How to avoid:**
- Store all observer instances in array: `const observers: IntersectionObserver[] = []`
- In useEffect cleanup: `observers.forEach(obs => obs.disconnect())`
- Remove sentinel elements: `querySelectorAll('.scroll-sentinel').forEach(el => el.remove())`
**Warning signs:** Browser DevTools show increasing observer count, DOM elements accumulating

### Pitfall 5: Scroll Depth on Pages with Little Content
**What goes wrong:** Short pages (< viewport height) immediately fire 100% milestone, skewing averages.
**Why it happens:** 100% scroll depth reached as soon as page loads if content doesn't fill viewport.
**How to avoid:**
- Check `document.documentElement.scrollHeight > window.innerHeight` before setting up tracking
- Filter out pages with scrollHeight < 2x viewport in analytics display
- Display "Content shorter than screen" instead of 100% achievement
**Warning signs:** All pages show 100% scroll achievement rate

## Code Examples

Verified patterns from research and browser API documentation:

### Scroll Depth Tracking Hook (Shrike Website)
```typescript
// Source: IntersectionObserver API + Scroll depth implementation research
function useScrollDepth(pagePath: string, trackEvent: (name: string, data: any) => void) {
  useEffect(() => {
    // Skip if page content shorter than viewport (already fully visible)
    if (document.documentElement.scrollHeight <= window.innerHeight + 100) {
      return
    }

    const milestones = [25, 50, 75, 90, 100]
    const fired = new Set<number>()
    const observers: IntersectionObserver[] = []
    const sentinels: HTMLElement[] = []

    milestones.forEach((percent) => {
      // Create invisible sentinel at scroll depth
      const sentinel = document.createElement('div')
      sentinel.className = 'scroll-sentinel'
      sentinel.style.cssText = `
        position: absolute;
        top: ${percent}%;
        height: 1px;
        width: 100%;
        pointer-events: none;
        visibility: hidden;
      `
      document.body.appendChild(sentinel)
      sentinels.push(sentinel)

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !fired.has(percent)) {
              fired.add(percent)
              trackEvent('scroll_depth', {
                percent_scrolled: percent,
                page_path: pagePath,
                timestamp: Date.now()
              })
            }
          })
        },
        { threshold: 0 }
      )

      observer.observe(sentinel)
      observers.push(observer)
    })

    return () => {
      observers.forEach((obs) => obs.disconnect())
      sentinels.forEach((el) => el.remove())
    }
  }, [pagePath, trackEvent])
}
```

### Heartbeat Tracking Hook (Shrike Website)
```typescript
// Source: Matomo heartbeat documentation + Page Visibility API
function useHeartbeat(pagePath: string, trackEvent: (name: string, data: any) => void) {
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    let startTime = Date.now()
    let accumulatedTime = 0

    const sendHeartbeat = () => {
      const currentSession = Math.floor((Date.now() - startTime) / 1000)
      const totalTime = accumulatedTime + currentSession

      trackEvent('heartbeat', {
        time_on_page: totalTime,
        page_path: pagePath,
        timestamp: Date.now()
      })
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab backgrounded - pause heartbeat
        if (intervalId) {
          clearInterval(intervalId)
          intervalId = null
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          accumulatedTime += elapsed
        }
      } else {
        // Tab visible again - resume heartbeat
        startTime = Date.now()
        if (!intervalId) {
          intervalId = setInterval(sendHeartbeat, 15000) // Every 15 seconds
        }
      }
    }

    // Start heartbeat
    intervalId = setInterval(sendHeartbeat, 15000)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Send final heartbeat on page leave
    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sendHeartbeat() // Final ping
    }
  }, [pagePath, trackEvent])
}
```

### Integration with useNessusTracking
```typescript
// Source: Existing useNessusTracking.ts pattern
export function useNessusTracking(pagePath: string, websiteLabel: string) {
  // ... existing page view tracking ...

  const trackEvent = useCallback(/* ... existing ... */)

  // Add scroll depth tracking
  useScrollDepth(pagePath, trackEvent)

  // Add heartbeat tracking
  useHeartbeat(pagePath, trackEvent)

  return { trackEvent }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| addEventListener('scroll') + throttle | IntersectionObserver | 2016+ (Chrome 51) | 43% less main thread usage, no throttling needed |
| Scroll depth = 0 for last page | Heartbeat events every 10-15s | GA4 2020+ | Last page time captured, more accurate engagement metrics |
| Single 90% scroll event (GA4 default) | Custom thresholds (25/50/75/90/100) | GTM custom tracking 2018+ | Finer-grained drop-off analysis |
| focus/blur for tab visibility | Page Visibility API | 2013+ (98% support) | Accurate hidden detection (minimized, alt-tabbed) |
| localStorage for max scroll | sessionStorage | Privacy-first era 2024+ | Auto-clears on session end, less privacy concern |

**Deprecated/outdated:**
- **Scroll event listeners without passive flag**: Chrome console now warns, degrades Core Web Vitals (INP score)
- **Continuous scroll percentage events**: Replaced by milestone-only approach to reduce noise
- **jQuery scroll plugins**: Modern IntersectionObserver API makes these obsolete

## Open Questions

Things that couldn't be fully resolved:

1. **Should scroll depth and heartbeat be one phase or split?**
   - What we know: Scroll depth (IntersectionObserver) is simpler. Heartbeat (intervals + visibility) is more complex.
   - What's unclear: Whether user wants both delivered together or can wait for heartbeat enhancement
   - Recommendation: Split into 12-01 (scroll depth only) and future 12-02 (heartbeat). Immediate value from scroll, heartbeat adds complexity.

2. **What scroll milestones to track?**
   - What we know: GA4 default is 90%. Industry standard is 25/50/75/90/100. Some use 10% increments.
   - What's unclear: Whether Shrike pages benefit from fine-grained (10%) or coarse (25%) milestones
   - Recommendation: Start with 25/50/75/90/100 (5 milestones). Review data after 2 weeks, add granularity if needed.

3. **Heartbeat interval duration?**
   - What we know: Adobe uses 10s for video, Matomo recommends 15s for pages, GA4 uses engagement events ~10s
   - What's unclear: Optimal balance between data accuracy and request volume for low-traffic Shrike site
   - Recommendation: 15s intervals (4 pings/min). Review Supabase function invocation costs after deployment.

4. **How to visualize scroll depth in dashboard?**
   - What we know: Heatmaps (color gradient), funnel charts (milestone achievement %), bar charts (per-page rates)
   - What's unclear: Which visualization provides most actionable insights for Shrike content optimization
   - Recommendation: Start with simple table showing per-page milestone achievement rates (bar chart per milestone). Add heatmap visualization as future enhancement.

5. **Should existing TimeOnPage.tsx be replaced or enhanced?**
   - What we know: Existing component uses timestamp deltas (Phase 10). Heartbeat provides alternative time measurement.
   - What's unclear: Whether to show both metrics, replace old with new, or add toggle
   - Recommendation: Enhance existing component to show BOTH: "Transition-based time" (existing) and "Engagement time" (heartbeat) as separate rows. Document methodology difference.

## Sources

### Primary (HIGH confidence)
- [IntersectionObserver API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Native API documentation
- [Page Visibility API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) - Tab visibility detection
- [Use passive listeners - Chrome Developers](https://developer.chrome.com/docs/lighthouse/best-practices/uses-passive-event-listeners) - Scroll performance best practices
- useNessusTracking.ts from Shrike website (confirmed: event_name + event_data structure, session_id tracking)
- Visit interface from types.ts (confirmed: event_data is JSONB, supports arbitrary nested data)

### Secondary (MEDIUM confidence)
- [Google Analytics Scroll Depth Tracking - Analytify](https://analytify.io/google-analytics-scroll-depth-tracking/) - Industry standard thresholds
- [Scroll tracking with GA4 - Analytics Mania](https://www.analyticsmania.com/post/scroll-tracking-with-google-analytics-4-and-google-tag-manager/) - Event naming conventions
- [IntersectionObserver vs Scroll Events - ITNEXT](https://itnext.io/1v1-scroll-listener-vs-intersection-observers-469a26ab9eb6) - Performance comparison (43% CPU reduction)
- [Matomo Heartbeat Timer FAQ](https://matomo.org/faq/how-to/faq_21824/) - Heartbeat implementation for time-on-page
- [Page Visibility API with GTM - Simo Ahava](https://www.simoahava.com/analytics/use-page-visibility-api-google-tag-manager/) - Visibility change event handling
- [Scroll maps guide - ContentSquare](https://contentsquare.com/guides/heatmaps/scroll-maps/) - Visualization approaches
- [Debouncing and Throttling - CSS Tricks](https://css-tricks.com/debouncing-throttling-explained-examples/) - Event handler optimization

### Tertiary (LOW confidence)
- [The value of scroll depth - Usermaven](https://usermaven.com/blog/value-of-scroll-depth) - Use cases and benefits
- [Scroll Depth Secrets - Reffine](https://www.reffine.com/en/blog/Scroll-Depth-Secrets-How-and-why-to-track-it) - Industry benchmarks (60-80% good)
- [Local Storage vs Session Storage - Medium](https://ujjwal-kumar.medium.com/what-is-the-difference-between-local-storage-and-session-storage-in-javascript-fb74650cd383) - Storage selection rationale

## Metadata

**Confidence breakdown:**
- Scroll depth tracking approach: HIGH - IntersectionObserver is well-documented, widely-used standard
- Heartbeat implementation: MEDIUM - Multiple patterns exist (intervals, visibility handling), requires testing for edge cases
- Data model (event_data JSONB): HIGH - Existing pattern from useNessusTracking.ts, no schema changes needed
- Visualization patterns: MEDIUM - Multiple approaches valid, user preference needed
- Performance impact: HIGH - IntersectionObserver performance benefits well-documented

**Research date:** 2026-02-15
**Valid until:** 30 days (fast-moving domain - browser APIs stable but implementation patterns evolve)

**Key validation needed:**
- Verify Shrike pages have sufficient content length to make scroll tracking meaningful (run query for scrollHeight distribution)
- Test IntersectionObserver sentinel positioning on actual Shrike page layouts (dynamic content, lazy-loaded images)
- Confirm Supabase edge function rate limits accommodate heartbeat event volume (4 pings/min * concurrent users)
- User decision: Implement both scroll depth + heartbeat together, or scroll depth first?
