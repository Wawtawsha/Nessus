---
phase: 11-referrer-analysis-geo-distribution
plan: 01
subsystem: ui
tags: [react, nextjs, typescript, useMemo, analytics, referrer-tracking, geolocation, date-fns]

# Dependency graph
requires:
  - phase: 10-session-journeys-time-on-page
    provides: Deep Dive tab with SessionJourneys and TimeOnPage sections
  - phase: 09-component-decomposition
    provides: Section component pattern, Visit interface, shared components (StatCard, BreakdownCard)
provides:
  - ReferrerAnalysis component categorizing traffic sources with engagement quality metrics
  - GeoDistribution component showing visitor distribution by city and country
  - Extended Visit interface with referrer and geographic fields (referrer, country, city, region, latitude, longitude)
affects: [12-scroll-depth, future-analytics-sections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Referrer categorization with strict precedence order (fbclid tracking param > social domains > self-referral > null=Direct > Other)
    - Engagement quality metric: average events per session grouped by referrer source
    - US state abbreviation map for "City, ST" formatting
    - Geographic data filtering (93.5% coverage via non-null city field)

key-files:
  created:
    - crm-dashboard/app/(dashboard)/analytics/components/sections/ReferrerAnalysis.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/GeoDistribution.tsx
  modified:
    - crm-dashboard/app/(dashboard)/analytics/components/shared/types.ts
    - crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx

key-decisions:
  - "fbclid tracking param checked FIRST in referrer categorization (handles shrike.vercel.app?fbclid=... as Facebook, not self-referral)"
  - "Engagement quality defined as avg events/session per referrer source (identifies high-quality traffic sources)"
  - "US state names mapped to 2-letter abbreviations for compact city display (e.g. 'Farmville, VA')"
  - "Geographic coverage stat shows percentage of visits with geo data (helps identify data quality)"
  - "Top 15 cities displayed to balance insight vs UI clutter"

patterns-established:
  - "Referrer categorization pattern: check fbclid → social domains → self-referral → null=Direct → Other"
  - "Session attribution: assign referrer category from FIRST event in session (landing page)"
  - "State abbreviation helper: formatCityRegion(city, region) with US_STATE_ABBREV lookup"
  - "Percentage bar visualization: width proportional to max value, not total (visual hierarchy)"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 11 Plan 01: Referrer Analysis + Geographic Distribution Summary

**Deep Dive tab now surfaces traffic source quality and visitor geography: referrer categorization with engagement metrics (avg events/session per source) and city-level distribution with US state abbreviations**

## Performance

- **Duration:** 4.5 min
- **Started:** 2026-02-16T01:12:13Z
- **Completed:** 2026-02-16T01:16:44Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- ReferrerAnalysis component categorizes traffic into 5 source types (Direct, Facebook, Instagram, Self-referral, Other) with strict precedence order handling fbclid tracking params
- Engagement quality metric shows avg events/session per referrer source, revealing which traffic sources produce most engaged visitors
- GeoDistribution component displays top 15 cities with US state abbreviations ("Farmville, VA") and country breakdown when multiple countries exist
- Extended Visit interface with 6 new fields (referrer, country, city, region, latitude, longitude) - no migration needed, columns pre-exist
- Deep Dive tab now has 4 sections: SessionJourneys, TimeOnPage, ReferrerAnalysis, GeoDistribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Visit interface with referrer + geo fields** - `9d5b915` (feat)
2. **Task 2: Create ReferrerAnalysis section component** - `b793fdd` (feat)
3. **Task 3: Create GeoDistribution + wire both into Deep Dive** - `876328b` (feat)

## Files Created/Modified

### Created
- `components/sections/ReferrerAnalysis.tsx` - Categorizes referrers into 5 source types using strict precedence (fbclid tracking param checked first to handle Facebook click-throughs on self-referral domain). Shows summary stats (Unique Sources, Social Traffic %, Top Source) and source breakdown table with colored dots, percentage bars, and engagement quality metric (avg events/session per source). Handles null referrers as "Direct" category. All computation via useMemo.

- `components/sections/GeoDistribution.tsx` - Shows geographic distribution with US state abbreviation map (51 entries for all states + DC). Formats cities as "City, ST" for US states or "City, Region" for non-US. Displays summary stats (Unique Cities, Unique Countries, Geo Coverage %) and top 15 cities table with percentage bars. Shows country breakdown if multiple countries detected. Uses BreakdownCard component for country visualization.

### Modified
- `components/shared/types.ts` - Extended Visit interface with 6 new fields: referrer (string | null), country (string | null), city (string | null), region (string | null), latitude (number | null), longitude (number | null). These fields already exist in Supabase visits table, no migration needed.

- `components/ShrikeAnalytics.tsx` - Updated Supabase select query from 6 columns to 12 columns (added referrer, country, city, region, latitude, longitude). Added imports for ReferrerAnalysis and GeoDistribution. Wired both new sections into Deep Dive tab after SessionJourneys and TimeOnPage.

## Decisions Made

1. **fbclid tracking param precedence** - Referrer categorization checks for fbclid tracking parameter FIRST before other patterns. This handles edge case where Facebook click-through appears as "shrike.vercel.app?fbclid=..." (would be categorized as self-referral by domain match, but is actually Facebook traffic). Strict precedence order: fbclid → social domains → self-referral → null=Direct → Other.

2. **Engagement quality metric** - Defined engagement quality as average events per session grouped by referrer source. Implementation: group visits by session_id, assign each session to referrer category of its FIRST event (landing page), count events per session, average within each category. This reveals which traffic sources produce most engaged visitors (more events = deeper engagement).

3. **US state abbreviation map** - Created 51-entry US_STATE_ABBREV map (50 states + DC) to format cities compactly as "City, ST" for US locations. Full state names in database (e.g. "Virginia") are mapped to 2-letter codes (e.g. "VA") for display. Non-US regions display full name ("Toronto, Ontario").

4. **Geographic coverage stat** - Added "Geo Coverage" stat showing percentage of visits with geographic data (93.5% in current dataset). This helps identify data quality and explains why some visitors don't appear in geo breakdown.

5. **Top 15 cities limit** - Display top 15 cities to balance actionable insight vs UI clutter. Sorted by visit count descending, so most important cities always visible.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both section components followed established Phase 9 pattern. Extended Visit interface compiled cleanly with no type errors. Production build succeeded on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 12 (Scroll Depth):**
- Deep Dive tab has 4 working analytics sections (SessionJourneys, TimeOnPage, ReferrerAnalysis, GeoDistribution)
- Section component pattern proven for traffic source and geographic analytics
- Visit interface extensible for additional fields (e.g. scroll_depth column for Phase 12)
- Shared components (StatCard, BreakdownCard) available for reuse

**Implementation notes for future phases:**
- Referrer categorization pattern can be reused for campaign tracking (utm_source, utm_medium)
- Engagement quality metric pattern (avg events/session grouped by dimension) applies to any traffic source analysis
- US_STATE_ABBREV map in GeoDistribution could be extracted to shared/constants.ts if other components need it
- formatCityRegion helper pattern applies to any geographic display

**No blockers** - all Deep Dive analytics sections functional, site filter applies correctly to all sections via shared visits state.

---
*Phase: 11-referrer-analysis-geo-distribution*
*Completed: 2026-02-16*
