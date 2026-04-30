# Research Summary: Analytics Deep Dive (v1.3)

**Domain:** CRM analytics dashboard expansion -- session journeys, geographic visualization, referrer analysis, scroll depth, time on page
**Researched:** 2026-02-15
**Overall confidence:** HIGH

## Executive Summary

The existing Nessus CRM stack (Next.js 14, Supabase, Recharts 3.7, shadcn/ui, Tailwind) can handle all five planned features with at most one new dependency. Four of the five features (session journeys, referrer analysis, time on page, scroll depth display) require zero new npm packages -- they are pure data transformation and visualization using existing tools. The only feature that might justify a new dependency is geographic visualization, and even that has a viable zero-dependency alternative (enhanced tables with bar charts instead of a map).

The most significant finding is not about technology but about architecture: ShrikeAnalytics.tsx at 530+ lines is already straining, and adding 4-5 new analytics sections without decomposing it first will create a maintenance nightmare. The research unanimously recommends a Phase 0 refactor into section components with a tab-based layout before any new features land.

The second key finding is about data: the visits table already contains all columns needed (country, city, referrer, session_id, created_at, event_data JSONB) for 4 of 5 features. Only scroll depth tracking requires changes to the Shrike tracking hook. Time on page can be estimated from existing timestamp data without any client-side changes (the "timestamp diff" approach), deferring explicit capture to when scroll depth tracking is added.

The third finding is about event noise: scroll depth tracking will generate 1-4 new rows per page view, which could inflate existing metrics (total interactions, avg per session) if not handled carefully. An event classification system (passive vs active) or a consolidated `page_exit` beacon approach is needed before scroll events enter the database.

## Key Findings

**Stack:** 0-1 new dependencies. react-simple-maps (35kB gzip) if a visual map is desired; otherwise zero. Recharts Sankey component is already installed but may be too sparse at ~500 visits to be useful -- individual session timeline is the safer primary visualization.

**Architecture:** Decompose ShrikeAnalytics into tab container + section components BEFORE adding features. Keep single-fetch-then-compute pattern at current scale (~500 rows). Two-tier tab layout: Overview (existing) + Deep Dive (new features).

**Critical pitfall:** Scroll depth events will silently corrupt ALL existing engagement metrics (total interactions, avg per session, daily activity) unless events are classified as passive/active or consolidated into single page_exit beacons.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Component Decomposition** -- Refactor ShrikeAnalytics into section components + tab layout
   - Addresses: Pitfall #1 (component bloat), enables clean integration of all subsequent features
   - Risk: Low (pure refactor, same visual output)

2. **Session Journeys + Time on Page (Estimated)** -- Build session timeline and timestamp-based time estimation
   - Addresses: Session journey timeline (table stakes), time on page from existing data
   - Uses: Existing data only, zero Shrike changes, zero new deps
   - Key decision: Individual session timeline as primary; defer Sankey until data volume supports it

3. **Referrer Analysis + Geographic Distribution** -- Referrer categorization and enhanced geo visualization
   - Addresses: Referrer grouping with engagement scoring, country/city visualization
   - Uses: Existing data (add country, city, referrer to SELECT query)
   - Key decision: Start with enhanced table/bars for geo; add react-simple-maps map if user wants visual map
   - Pitfall watch: "Direct" referrer is a garbage bin -- cross-reference with UA detection (Instagram browser shows as Direct)

4. **Scroll Depth + Time on Page (Explicit)** -- Client-side tracking + dashboard display
   - Addresses: Scroll depth capture, accurate time-on-page via page_exit beacon
   - Requires: Changes to Shrike useNessusTracking hook (cross-repo), event classification system
   - Pitfall watch: Event noise (#2), short page noise (#12), dynamic content height

5. **Database Indexes** -- Add session_id and composite indexes
   - Addresses: Future-proofing for scale
   - Can run as standalone migration anytime

**Phase ordering rationale:**
- Phase 1 (decomposition) unblocks all others and is lowest risk
- Phases 2-3 use only existing data, delivering value without blocking on Shrike changes
- Phase 4 (scroll depth) requires Shrike-side work and has the most edge cases -- putting it last means all other features ship independently
- Indexes are opportunistic, not blocking

**Research flags for phases:**
- Phase 2: Standard patterns, unlikely to need deeper research. Session reconstruction edge cases are well-documented in PITFALLS.md.
- Phase 3: May need deeper research IF a visual map is chosen (geocoding city names to coordinates, TopoJSON data selection). If table/bars approach is chosen, no research needed.
- Phase 4: Needs careful design research for the page_exit beacon pattern and event classification. The interaction between IntersectionObserver and Shrike's dynamic gallery loading (load-more) is a known edge case.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via npm, bundlephobia, official docs. react-simple-maps v3.0.0 confirmed React 18 compatible. react-leaflet v5 confirmed React 19 only. Recharts Sankey confirmed in 3.x API. |
| Features | HIGH | Feature landscape grounded in existing codebase analysis + competitive research (GA4, Plausible, PostHog patterns). |
| Architecture | HIGH | Based on direct analysis of ShrikeAnalytics.tsx (530 lines, 11 state vars) and data flow through track-visitor Edge Function. |
| Pitfalls | HIGH | 13 pitfalls identified with concrete code references. Critical pitfalls (#1 component bloat, #2 event noise, #3 fetch-all-at-scale) are well-supported. |

## Gaps to Address

- **Geocoding approach:** If a visual map is chosen, the city-to-coordinates lookup method needs a design decision (static JSON lookup, Edge Function enrichment, or country-level-only choropleth)
- **Sankey viability:** Cannot determine if Recharts Sankey produces a useful visualization at ~20 sessions without building a prototype. Recommend building individual timeline first, then evaluating Sankey on real data.
- **UTM tracking:** Prior to building referrer analysis, consider whether UTM parameter capture should be added to useNessusTracking. The referrer alone is insufficient for accurate attribution (Instagram in-app browser referrer is inconsistent).
- **page_exit beacon reliability:** `navigator.sendBeacon()` + `visibilitychange` is the recommended pattern for scroll depth + time-on-page, but its reliability on iOS Safari and in-app browsers needs phase-specific testing.

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | This file -- executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology recommendations: react-simple-maps (conditional), Recharts Sankey (existing), IntersectionObserver, visibilitychange |
| `.planning/research/FEATURES.md` | Feature landscape: 5 table stakes, 5 differentiators, 9 anti-features, dependency graph, MVP ordering |
| `.planning/research/ARCHITECTURE.md` | Component decomposition plan, data flow, tab layout, build order, 4 anti-patterns |
| `.planning/research/PITFALLS.md` | 13 pitfalls: 3 critical (component bloat, event noise, fetch-all scaling), 4 important, 3 moderate, 3 minor |
