# Technology Stack: Analytics Deep Dive Features

**Project:** Nessus CRM - ShrikeAnalytics Dashboard
**Researched:** 2026-02-15
**Scope:** Stack additions for session journeys, geographic heatmap, referrer analysis, scroll depth, time on page

## Executive Assessment

The existing stack (Recharts 3.7, shadcn/ui, Supabase, Next.js 14) can handle most new features with zero additions. The key question is whether a geographic map visualization justifies a new dependency or whether enhanced tables/bars suffice.

**Net new dependencies: 0 or 1 (react-simple-maps, conditional on whether a visual map is desired)**

---

## Recommended Stack Additions

### Geographic Visualization

**Two viable approaches -- make a deliberate choice:**

#### Option A: react-simple-maps (recommended IF visual map is desired)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-simple-maps | ^3.0.0 | SVG bubble/choropleth map for visitor locations | Lightweight (35kB gzip), zero tile server, SVG-native, works with existing Tailwind/shadcn styling, React 18 compatible |

**Comparison of map libraries:**

| Criterion | react-simple-maps | react-leaflet v4 | Mapbox (react-map-gl) |
|-----------|-------------------|-------------------|----------------------|
| Bundle size (gzip) | ~35kB | ~180kB + tile assets | ~220kB + API key |
| Tile server needed | No (SVG) | Yes (OpenStreetMap) | Yes (Mapbox) |
| API key required | No | No | Yes (free tier limits) |
| React 18 support | Yes (v3.0.0) | Yes (v4.x only, NOT v5) | Yes |
| Next.js SSR | Works (SVG) | Requires `dynamic` + `ssr: false` | Requires `dynamic` + `ssr: false` |
| Heatmap support | Bubble markers (sized/colored circles) | Plugin (leaflet.heat) | Built-in |
| Interactivity | Hover, click, tooltips | Full pan/zoom/layers | Full pan/zoom/3D |
| Complexity | Low | Medium | High |
| Maintenance | Last published 4 years ago (stable, thin wrapper over d3-geo) | Active | Active |

**The honest case for react-simple-maps:** The library is a thin declarative wrapper over d3-geo and topojson-client, both actively maintained. 148K weekly npm downloads (2026) -- stable, not abandoned. If React 19 migration happens later, `@vnedyalk0v/react19-simple-maps` fork exists.

**The honest case against:** The visits table stores `country` and `city` as strings, NOT coordinates. Placing dots on a map requires a geocoding step (city name to lat/lng). Options:
1. Country-level choropleth only (color countries by count) -- simplest, no geocoding needed
2. Static lookup table of known cities to coordinates -- works for the ~10-20 unique cities in current data
3. Geocode at Edge Function ingest time -- changes the tracking pipeline

**Caveat:** react-simple-maps hasn't been updated in 4 years. It works, but it's a risk factor for a project that may eventually migrate to React 19.

**Required companion data (loaded via CDN URL, no npm dep):**
```
# US: https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json
# World: https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

#### Option B: Enhanced table/bar visualization (no new dependency)

At ~500 visits with 5-10 countries and 10-20 cities, a sorted table with progress bars communicates the same information as a map. This is what the visits page already does. The prior architecture research argues persuasively that a map adds a dependency and geocoding complexity for marginal visual benefit at this scale.

**Recommendation:** Start with Option B (enhanced bars/table in the Deep Dive tab). If the user explicitly wants a visual map, Option A is the right choice -- but acknowledge the geocoding gap and start with country-level choropleth.

---

### Session Journey Visualization

**Two layers, both using existing stack:**

#### Layer 1: Individual Session Timeline (primary)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind + lucide-react | (existing) | Vertical timeline of events within a single session | A timeline is a styled `<ul>` -- no library needed |

This is the high-value feature: click a session, see every page view and event in chronological order with timestamps and time deltas. Build as a simple expandable list component.

#### Layer 2: Aggregate Session Flow (Sankey) -- CONDITIONAL

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| recharts (Sankey) | ^3.7.0 (existing) | Aggregate flow diagram showing page-to-page transitions | Already installed, zero new deps |

**Important tension to resolve:** The Recharts Sankey component exists and is free (already installed). However, prior research correctly flags that with ~500 visits across ~20 sessions, a Sankey diagram may be too sparse to show meaningful patterns. Sankey works best with hundreds or thousands of flows.

**Recommendation:** Build the individual session timeline first (Phase 1 value). Add Sankey as an optional "aggregate view" toggle within the same section ONLY if session volume warrants it. The component is free to add since Recharts is already installed -- the cost is only the data transformation logic, not a dependency.

---

### Referrer Analysis: Pure Code (no new dependencies)

Referrer categorization is string classification logic, not a library problem.

**Implementation approach:**
```typescript
type ReferrerCategory = 'direct' | 'organic_search' | 'social' | 'referral' | 'email' | 'paid'

function categorizeReferrer(referrer: string | null): ReferrerCategory {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname
    if (/google\.|bing\.|yahoo\.|duckduckgo\./i.test(host)) return 'organic_search'
    if (/facebook\.|instagram\.|twitter\.|linkedin\.|tiktok\./i.test(host)) return 'social'
    return 'referral'
  } catch {
    return 'direct' // malformed referrer
  }
}
```

The referrer field already exists in the visits table. The current ShrikeAnalytics query just doesn't select it -- add `referrer` to the `.select()` call. The visits page already has basic referrer display; this enhances it with categorization and per-referrer engagement scoring.

---

### Scroll Depth Tracking: Browser API (no new dependencies)

**Capture side (Shrike website):** IntersectionObserver API -- native browser API, 97%+ support, no library needed.

**Implementation approach:**
```typescript
// Place sentinel elements at scroll depth milestones
// IntersectionObserver fires when each enters viewport
// trackEvent('scroll_depth', { depth: 25|50|75|100 })
// Deduplicate: fire each milestone once per page load per session
```

**Why NOT scroll event listeners:** IntersectionObserver runs off the main thread, doesn't need throttling, fires exactly once per threshold crossing.

**Known edge case (flagged by architecture research):** Shrike photo galleries use load-more/infinite scroll, which changes page height dynamically. "100% scroll depth" is ambiguous when content length changes. Mitigation: track depth relative to initially-loaded content, or use fixed pixel-based sentinels instead of percentage-based. This is an implementation detail, not a stack question.

**Display side (CRM dashboard):** Funnel visualization (reuse existing funnel pattern) or simple bar chart with Recharts BarChart. No new chart types needed.

---

### Time on Page: Two Approaches, Choose One

#### Approach A: Estimate from existing timestamps (no Shrike changes)

Calculate time-on-page by diffing consecutive `created_at` timestamps within the same `session_id`. This is how traditional Google Analytics worked.

**Pros:** Zero changes to Shrike. Works with data that already exists.
**Cons:** Last page in session has no "next event" so time = 0 for it. Sessions with only one event (bounces) have no time data at all. Accuracy depends on users generating multiple events.

#### Approach B: Explicit capture via visibilitychange (Shrike changes)

Track duration using `visibilitychange` + `beforeunload` events, sending a `time_on_page` event when the user leaves.

**Pros:** Accurate for all pages including last page. Works for bounce visits.
**Cons:** Requires Shrike website changes. `beforeunload` doesn't always fire on mobile. Next.js client-side navigation won't trigger `beforeunload` -- need to hook into Next.js Router events too. `navigator.sendBeacon()` needed for reliability.

**Recommendation:** Start with Approach A (timestamp estimation). It's free, uses existing data, and provides "good enough" estimates for an admin tool with 500 visits. Add explicit capture (Approach B) in the same phase as scroll depth tracking since both require Shrike-side changes. The timestamp estimation provides immediate value without blocking on Shrike deployment.

**Display side (both approaches):** Stat cards (avg time per session, avg time per page) + bar chart (time by page). All achievable with existing Recharts + Tailwind.

---

## Supabase Changes Required

### Immediate: Expand the SELECT

Current query misses 3 columns needed for new features:
```typescript
// Current:
.select('event_name, event_data, session_id, page_path, created_at, user_agent')

// Updated:
.select('event_name, event_data, session_id, page_path, created_at, user_agent, country, city, referrer')
```

At ~500 rows, this is trivial. Client-side computation remains the right pattern.

### Recommended: Database Indexes (migration)

At ~500 rows PostgreSQL will table-scan and be fast. These indexes cost nothing and help at 10K+:

```sql
-- Session-based queries (session journey drill-down)
CREATE INDEX IF NOT EXISTS idx_visits_session_id
  ON visits(session_id);

-- Composite for main analytics query
CREATE INDEX IF NOT EXISTS idx_visits_client_created
  ON visits(client_id, created_at DESC);
```

**NOT recommended yet:** Per-column indexes on country, city, referrer. These only help if those columns appear in WHERE clauses, which they don't -- the pattern is "fetch all for client, filter/group in JS."

### NOT Recommended: New RPCs or New Tables

No new tables needed. Scroll depth and time-on-page events fit in existing `visits` table via `event_name` + `event_data` JSONB.

No new RPCs needed at this scale. The single-fetch-then-compute pattern is correct at ~500 rows. Add RPCs when analytics page load exceeds ~2 seconds (likely around 5-10K rows per client).

---

## What NOT to Add (and Why)

| Rejected Option | Why Not |
|----------------|---------|
| Mapbox / react-map-gl | Requires API key, 220kB, overkill for this data volume |
| react-leaflet | 180kB + tile assets + SSR workaround. Designed for interactive maps with pan/zoom/layers -- not analytics visualization |
| d3.js (directly) | Recharts already wraps D3. Adding raw D3 creates two paradigms |
| visx | Another charting library when Recharts already covers all needed types |
| react-chrono | Timeline library for something buildable in 20 lines of Tailwind |
| Google Maps API | API key, usage limits, no advantage over SVG at this scale |
| Amplitude / Mixpanel / PostHog SDK | You have a custom analytics pipeline. Third-party SDK defeats the purpose |
| hotjar / fullstory | Scroll depth via third-party adds privacy concerns and vendor lock-in |

---

## Changes to Shrike Website (Tracking Hook)

**Required changes to `useNessusTracking.ts` in the Shrike repo:**

1. **Scroll depth tracking** -- New scroll observer (IntersectionObserver) firing at 25/50/75/100% milestones
2. **Time on page capture** (optional, Approach B) -- `visibilitychange` + `beforeunload` + Next.js router events

Both use native browser APIs. Zero new npm dependencies in the Shrike project. The `track-visitor` Edge Function already accepts arbitrary `event_name` + `event_data`, so no Edge Function changes needed.

---

## Installation Summary

```bash
# In crm-dashboard/ -- ONLY if visual map is desired:
npm install react-simple-maps

# Otherwise: zero new dependencies needed
```

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| react-simple-maps IF map desired | HIGH | Verified: npm v3.0.0, React 18 compatible, 148K weekly downloads, 35kB gzip. Verified via npm registry + bundlephobia. |
| Enhanced table as map alternative | HIGH | Validated by codebase analysis -- visits/page.tsx already displays geo data as tables |
| Recharts Sankey available | HIGH | Verified: Recharts 3.x API docs confirm Sankey component. Already installed at v3.7.0. |
| Sankey useful at current scale | LOW | ~500 visits / ~20 sessions may be too sparse for meaningful flow patterns. Individual timeline is safer bet. |
| No lib for referrer analysis | HIGH | Domain logic -- string classification, not a library problem |
| IntersectionObserver for scroll depth | HIGH | MDN confirms universal browser support. Standard approach. |
| Timestamp-diff for time on page | HIGH | Same approach as traditional GA. Works with existing data, no Shrike changes. |
| visibilitychange for time on page | MEDIUM | Standard but has SPA edge cases (Next.js router, mobile beforeunload). |
| No new Supabase tables | HIGH | event_data JSONB designed for extensibility. Confirmed by examining existing patterns. |
| Defer RPC functions | MEDIUM | Correct at ~500 rows. Reassess if data grows to 5K+ per client. |
| react-leaflet v5 incompatible | HIGH | Verified: v5 requires React 19 as peer dep. Must use v4.x for React 18. |

---

## Sources

- [react-simple-maps npm](https://www.npmjs.com/package/react-simple-maps) - v3.0.0, 148K weekly downloads
- [react-simple-maps official site](https://www.react-simple-maps.io/) - Examples, Marker/Annotation docs
- [react-simple-maps bundlephobia](https://bundlephobia.com/package/react-simple-maps) - 35kB gzip
- [react-leaflet npm](https://www.npmjs.com/package/react-leaflet) - v5 requires React 19; v4.x for React 18
- [react-leaflet SSR with Next.js](https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i) - Requires dynamic import + ssr:false
- [Recharts Sankey API](https://recharts.github.io/en-US/api/Sankey/) - Built-in component, nodes/links data
- [Recharts GitHub](https://github.com/recharts/recharts) - v3.7.0 confirmed
- [MDN IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Universal browser support
- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization) - Index guidance
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) - RPC endpoint creation
- [Supabase Index Management](https://supabase.com/docs/guides/database/postgres/indexes) - Index best practices
- [LogRocket React Map Comparison](https://blog.logrocket.com/react-map-library-comparison/) - Library comparison
- [@vnedyalk0v/react19-simple-maps](https://www.npmjs.com/package/@vnedyalk0v/react19-simple-maps) - React 19 fork
- [Plausible scroll depth](https://plausible.io/blog/scroll-depth-tracking) - Industry standard milestones (25/50/75/100%)
