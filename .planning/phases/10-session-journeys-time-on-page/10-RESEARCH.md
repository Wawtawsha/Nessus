# Phase 10: Session Journeys + Time on Page - Research

**Researched:** 2026-02-15
**Domain:** Session-based web analytics, time-on-page metrics, journey visualization
**Confidence:** HIGH

## Summary

Phase 10 adds session journey visualization and time-on-page metrics to the Deep Dive tab. Research reveals the current tracking implementation captures all necessary data (session_id, timestamps, page_path, event_name) to build these features without any backend changes.

Session journeys can be visualized as either simple chronological event lists (recommended for MVP) or flow diagrams (Sankey/Sunburst for future enhancement). Time-on-page must be calculated as timestamp deltas between consecutive events within a session, with special handling for the last page (no subsequent timestamp available).

The established section component pattern from Phase 9 applies directly: create new section components in Deep Dive tab that receive raw visits array, group by session_id, compute metrics via useMemo, and render with existing shared components or simple custom UI.

**Primary recommendation:** Build two section components - SessionJourneys (chronological event list grouped by session) and TimeOnPage (aggregated page durations), both using custom UI without external libraries. This aligns with project philosophy of simple, readable code and leverages existing patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | UI framework | Already in use, section components use useMemo pattern |
| TypeScript | 5.0.0 | Type safety | Visit interface provides type contract |
| date-fns | 4.1.0 | Date manipulation | Already installed, handles timestamp parsing and duration formatting |
| Tailwind CSS | 3.4.0 | Styling | Project standard, all sections use utility classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 3.7.0 | Charts | IF adding time-on-page chart visualization (not required for MVP) |
| Object.groupBy | Native (2024+) | Session grouping | Modern alternative to reduce, cleaner syntax for grouping visits by session_id |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom timeline | react-event-timeline, MUI Timeline, Syncfusion Timeline | External deps add complexity; custom list view is simpler and matches project patterns |
| Custom flow viz | Recharts Sankey, Sunburst charts | Sankey requires complex data transformation; better as future enhancement after validating MVP |
| reduce() | Object.groupBy() or Map.groupBy() | groupBy is more readable but browser support only since late 2024; reduce is safer fallback |

**Installation:**
```bash
# No new packages required - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
components/sections/
├── SessionJourneys.tsx         # NEW - chronological event list grouped by session
├── TimeOnPage.tsx              # NEW - aggregated page duration metrics
└── [8 existing sections]

components/shared/
├── types.ts                    # EXISTING - Visit interface already defined
├── constants.ts                # EXISTING - formatEventName already available
└── [existing shared components]
```

### Pattern 1: Session Grouping
**What:** Group visits array by session_id to create session objects containing chronologically ordered events
**When to use:** For any session-based analytics (journeys, duration, event sequences)
**Example:**
```typescript
// Source: Established pattern from DeviceBrowserOS.tsx + Object.groupBy research
const sessions = useMemo(() => {
  // Group visits by session_id
  const sessionMap = new Map<string, Visit[]>()

  visits.forEach((visit) => {
    if (!visit.session_id) return

    if (!sessionMap.has(visit.session_id)) {
      sessionMap.set(visit.session_id, [])
    }
    sessionMap.get(visit.session_id)!.push(visit)
  })

  // Sort events within each session by timestamp
  sessionMap.forEach((events) => {
    events.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  })

  return Array.from(sessionMap.values())
}, [visits])
```

### Pattern 2: Time Between Events Calculation
**What:** Calculate duration between consecutive events using timestamp deltas
**When to use:** Time-on-page, session duration, engagement time
**Example:**
```typescript
// Source: Time on page calculation research + date-fns
import { differenceInSeconds } from 'date-fns'

const calculateTimeOnPage = (sessionEvents: Visit[]) => {
  const pageTimes = new Map<string, number>()

  for (let i = 0; i < sessionEvents.length - 1; i++) {
    const current = sessionEvents[i]
    const next = sessionEvents[i + 1]

    // Skip if not a page view or if page_path is null
    if (current.event_name || !current.page_path) continue

    const duration = differenceInSeconds(
      new Date(next.created_at),
      new Date(current.created_at)
    )

    // Add to accumulated time for this page
    const existing = pageTimes.get(current.page_path) || 0
    pageTimes.set(current.page_path, existing + duration)
  }

  // Note: Last page in session has no duration (no next timestamp)
  return pageTimes
}
```

### Pattern 3: Section Component for Session Data
**What:** Section component that groups by session, computes metrics, renders with simple UI
**When to use:** Any Deep Dive analytics involving sessions
**Example:**
```typescript
// Source: Established pattern from Phase 9 sections
export function SessionJourneys({ visits }: { visits: Visit[] }) {
  const sessions = useMemo(() => {
    // Group and compute logic here
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Session Journeys
      </h2>
      {/* Render sessions as chronological list */}
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Don't calculate time for last page in session** - There's no next timestamp, duration will be inaccurate. GA4 has same limitation. Either skip or use special handling (heartbeat events).
- **Don't pre-compute session metrics in parent** - Violates Phase 9 pattern; sections should compute from raw visits via useMemo.
- **Don't use heavy visualization libraries for MVP** - Sankey diagrams look impressive but require complex data transformation and add dependencies. Start with simple list view.
- **Don't count every visit row as unique session** - Must deduplicate by session_id (see DeviceBrowserOS.tsx pattern with Map).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing and formatting | Custom Date() manipulation | date-fns (already installed) | Handles timezones, edge cases, provides readable formatters |
| Event name formatting | Custom string replace logic | formatEventName from shared/constants.ts | Already exists, consistent with other sections |
| Session deduplication | Array loops with conditionals | Map or Set with session_id key | Faster lookups, prevents duplicates naturally |
| Duration formatting | Manual seconds-to-minutes math | date-fns formatDuration or intervalToDuration | Handles pluralization, localization |

**Key insight:** The project already has established patterns and utilities. Reuse parseUA, formatEventName, StatCard, BreakdownCard, and Visit interface rather than creating new variants.

## Common Pitfalls

### Pitfall 1: Last Page Has No Duration
**What goes wrong:** Time-on-page calculation for the last page in a session returns 0 or undefined because there's no subsequent event to calculate the delta.
**Why it happens:** Analytics tracks time between events, but exit/close doesn't send a timestamp.
**How to avoid:**
- Document this limitation explicitly in the UI ("Duration based on page transitions")
- Don't include last page in time-on-page metrics OR
- Consider last page as "unknown duration" with special handling
**Warning signs:** Sum of time-on-page doesn't match total session duration

### Pitfall 2: Session Includes Both Page Views and Events
**What goes wrong:** Counting all visit rows as "pages" includes interaction events (clicks, downloads), inflating page view counts.
**Why it happens:** Visit table stores both page views (event_name = null) and events (event_name populated).
**How to avoid:** Filter for page views: `visits.filter(v => !v.event_name)` before calculating page-specific metrics. See EngagementOverview.tsx line 7 for established pattern.
**Warning signs:** Page count in session journey doesn't match actual pages (includes clicks)

### Pitfall 3: Null/Missing session_id
**What goes wrong:** Some visits don't have session_id, causing grouping to fail or create an "undefined" session.
**Why it happens:** Tracking mechanism might fail, old data before session tracking, or bot traffic.
**How to avoid:** Filter out nulls: `if (!visit.session_id) return` (see research example). Count and potentially display how many visits were excluded.
**Warning signs:** Sessions with dozens of different IPs or user agents

### Pitfall 4: Unsorted Events Within Session
**What goes wrong:** Session journey displays events out of chronological order, making flow incomprehensible.
**Why it happens:** Visits table query doesn't guarantee order; network timing can cause out-of-order inserts.
**How to avoid:** ALWAYS sort events by created_at timestamp after grouping: `events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())`
**Warning signs:** Journey shows form submit before form opened

### Pitfall 5: Time Calculation Across Sessions
**What goes wrong:** Duration calculated between last event of session A and first event of session B (different users/times).
**Why it happens:** Sorting all visits by timestamp without first grouping by session.
**How to avoid:** Group by session FIRST, then sort within each session. Never calculate time deltas across session boundaries.
**Warning signs:** Impossible durations like hours between consecutive events

## Code Examples

Verified patterns from research and existing codebase:

### Session Grouping and Sorting
```typescript
// Source: DeviceBrowserOS.tsx pattern + research
const sessions = useMemo(() => {
  const sessionMap = new Map<string, Visit[]>()

  visits.forEach((v) => {
    if (!v.session_id) return // Skip visits without session

    if (!sessionMap.has(v.session_id)) {
      sessionMap.set(v.session_id, [])
    }
    sessionMap.get(v.session_id)!.push(v)
  })

  // Sort events chronologically within each session
  sessionMap.forEach((events) => {
    events.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  })

  // Convert to array and sort sessions by start time (most recent first)
  return Array.from(sessionMap.values())
    .sort((a, b) =>
      new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
    )
}, [visits])
```

### Time on Page Aggregation
```typescript
// Source: Time on page research + date-fns docs
import { differenceInSeconds } from 'date-fns'

const pageTimeStats = useMemo(() => {
  const pageDurations = new Map<string, number[]>() // path -> array of durations

  // For each session, calculate time spent on each page
  sessions.forEach((sessionEvents) => {
    for (let i = 0; i < sessionEvents.length - 1; i++) {
      const current = sessionEvents[i]
      const next = sessionEvents[i + 1]

      // Only calculate for page views (not events)
      if (current.event_name || !current.page_path) continue

      const duration = differenceInSeconds(
        new Date(next.created_at),
        new Date(current.created_at)
      )

      // Skip unrealistic durations (>30 min = likely abandoned tab)
      if (duration > 1800) continue

      if (!pageDurations.has(current.page_path)) {
        pageDurations.set(current.page_path, [])
      }
      pageDurations.get(current.page_path)!.push(duration)
    }
  })

  // Compute averages
  return Array.from(pageDurations.entries())
    .map(([page, durations]) => ({
      page,
      avgTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      samples: durations.length
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
}, [sessions])
```

### Duration Formatting
```typescript
// Source: date-fns documentation
import { intervalToDuration, formatDuration } from 'date-fns'

const formatTime = (seconds: number): string => {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 })
  return formatDuration(duration, { format: ['minutes', 'seconds'] })
}

// Usage: formatTime(127) => "2 minutes 7 seconds"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session duration from first/last timestamp | User engagement time (tab visibility aware) | GA4 (2020+) | More accurate, excludes backgrounded tabs |
| Sankey diagrams for all flows | Sunburst charts for complex journeys | 2024+ | Better space efficiency for multi-step sequences |
| Array.reduce for grouping | Object.groupBy / Map.groupBy | Late 2024 | More readable, but check browser support |
| Time on page = 0 for last page | Heartbeat events every 5-15s | GA4 custom metrics 2023+ | Captures exit page time, requires tracking changes |

**Deprecated/outdated:**
- **Universal Analytics time calculation**: Relied purely on hit timestamps, always showed 0 for bounces. GA4 improved with engagement events.
- **Bounce rate as primary metric**: GA4 de-emphasized bounce rate in favor of engagement rate (inverse metric with better signal).

## Open Questions

Things that couldn't be fully resolved:

1. **Browser support for Object.groupBy**
   - What we know: Native since late 2024, cleaner than reduce
   - What's unclear: Whether project supports older browsers that lack this
   - Recommendation: Use Map + forEach pattern (shown in examples) which works everywhere

2. **Should we track heartbeat events for last page time?**
   - What we know: Current tracking doesn't send periodic pings, so last page has no duration
   - What's unclear: Whether adding heartbeat to useNessusTracking is in scope for this phase
   - Recommendation: Document the limitation, mark as future enhancement. Don't block on tracking changes.

3. **How many sessions exist in actual data?**
   - What we know: EngagementOverview.tsx counts unique sessions, DeviceBrowserOS.tsx groups by session
   - What's unclear: Whether there are enough sessions to make journey view useful (need 10+ for validation)
   - Recommendation: Verify with live data query before implementation

4. **Visualization preference: List vs Flow Diagram?**
   - What we know: Sankey looks impressive but requires complex data transformation; List is simple
   - What's unclear: User preference and whether simple list meets needs
   - Recommendation: Build list view first (MVP), add Sankey as enhancement if requested

## Sources

### Primary (HIGH confidence)
- Visit interface from types.ts (confirmed: session_id, page_path, event_name, created_at, user_agent all available)
- Existing section component patterns from Phase 9 (EngagementOverview.tsx, DeviceBrowserOS.tsx, ActivityTimeline.tsx)
- useNessusTracking.ts from Shrike website (confirmed: session_id generated client-side, stored in sessionStorage)
- date-fns 4.1.0 in package.json (confirmed installed)

### Secondary (MEDIUM confidence)
- [Time on Page Explained - Simple Analytics](https://docs.simpleanalytics.com/explained/time-on-page) - Calculation methodology
- [Misunderstood Metrics: GA 4 Time on Page - Analytics Edge](https://help.analyticsedge.com/article/misunderstood-metrics-time-on-page-session-duration/) - Last page limitation
- [Recharts Sankey API](https://recharts.github.io/en-US/api/Sankey/) - Data structure requirements
- [Object.groupBy() - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy) - Modern grouping method
- [Sankey vs Sunburst Diagrams - Quantum Metric](https://www.quantummetric.com/blog/sankey-diagram-vs-sunburst-diagram-what-are-the-differences) - Visualization comparison

### Tertiary (LOW confidence)
- [Customer Journey Analytics Best Practices - FullStory](https://www.fullstory.com/blog/customer-journey-analytics/) - Industry trends
- [Best React Timeline Libraries - LogRocket](https://blog.logrocket.com/comparing-best-react-timeline-libraries/) - Component options
- [Session Replay Tools 2026 - Quantum Metric](https://www.quantummetric.com/blog/best-session-replay-tools-in-2026) - Modern analytics features

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed, no new packages needed
- Architecture patterns: HIGH - Phase 9 established section component pattern, directly applicable
- Time calculation: HIGH - Standard timestamp delta approach, verified with date-fns docs
- Pitfalls: HIGH - Last page duration is well-documented GA limitation, other pitfalls from existing code patterns
- Visualization options: MEDIUM - Multiple approaches possible, recommendation based on project philosophy

**Research date:** 2026-02-15
**Valid until:** 60 days (stable domain - session analytics patterns don't change rapidly)

**Key validation needed:**
- Confirm actual session_id coverage in production data (query visits table)
- Verify browser support requirements if considering Object.groupBy
- User preference for visualization style (simple list vs flow diagram)
