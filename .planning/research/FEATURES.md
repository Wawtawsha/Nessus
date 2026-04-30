# Feature Landscape: Analytics Deep Dive (v1.3)

**Domain:** Admin analytics dashboard for photo gallery visitor engagement
**Researched:** 2026-02-15
**Scale context:** ~500 visits, 2 gallery sites, 1-2 admin users

## Existing Data Model (What We Already Capture)

Understanding what data exists determines what features are feasible without client-side changes.

**Visits table columns (confirmed from code):**
- `id`, `client_id`, `website_label` -- identity/scoping
- `session_id` -- session grouping (generated client-side, `sess_` prefix)
- `page_path` -- which page was viewed
- `event_name` -- null for page views, string for interactions
- `event_data` -- JSON blob (photo_id, filename, etc.)
- `referrer` -- HTTP referrer (captured on every row, not just first visit)
- `user_agent` -- browser UA string
- `ip_address` -- visitor IP
- `country`, `city` -- geo data (populated by edge function from IP)
- `created_at` -- timestamp

**What is NOT currently captured:**
- Scroll depth (no events exist)
- Time-on-page heartbeat (no events exist)
- UTM parameters on visits (only on leads table)
- Latitude/longitude (only country/city strings)
- Screen resolution or viewport size

---

## Table Stakes

Features users expect from an analytics deep dive. Missing = milestone feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Session journey timeline | Core promise of v1.3; session_id + timestamps already exist | **Medium** | Existing data only | Group events by session_id, display as vertical timeline |
| Referrer analysis with grouping | Referrer data already captured but shown raw; grouping adds meaning | **Low** | Existing data only | Classify into Direct/Social/Search/Other; hostname extraction already started in visits page |
| Time on page (estimated) | Expected metric; calculable from existing timestamps | **Low** | Existing data only | Diff between consecutive events in same session; inherent last-page problem |
| Geographic visitor list (enhanced) | Country/city data exists but only shown as text list; needs better presentation | **Low-Medium** | Existing data only | Ranked table with session counts per location, not just visit counts |

### Session Journey Timeline -- Detail

**How it works in real tools:**
- PostHog shows session replays with an event timeline sidebar listing every action with timestamps. Sessions reset after 30 minutes of inactivity or 24 hours.
- Mixpanel and Amplitude use path analysis / user journey mapping to show aggregate flow between steps.
- For a 1-2 person admin tool at ~500 visits, the right approach is **individual session timeline** (list sessions, click to expand event sequence) rather than aggregate Sankey/flow diagrams.

**What to build:**
1. Session list view: show sessions sorted by recency with summary (page count, event count, duration, first page)
2. Session detail: click to expand into vertical timeline of page views and events with timestamps and time deltas between steps
3. Filter by site, date range

**What NOT to build:**
- DOM replay (PostHog-style video). Requires capturing DOM mutations, massive complexity, zero value at this scale.
- Sankey/flow diagrams. Recharts has a Sankey component, but with ~500 visits the flows would be too sparse to show meaningful patterns. Sankey diagrams become cluttered or meaningless with small datasets.

**Confidence:** HIGH -- session_id and created_at are already on every row; this is pure display logic.

### Referrer Analysis with Grouping -- Detail

**How it works in real tools:**
- Google Analytics GA4 groups into channels: Direct, Organic Search, Organic Social, Paid Search, Referral, Email, etc. based on utm_medium + referrer hostname matching.
- Plausible groups into: Direct/None, Organic Social, Paid Search, Email, Referral. Uses a maintained list of known social/search domains.
- The key insight: raw referrer URLs are noisy. Grouping into categories makes the data actionable.

**What to build:**
1. Classify referrers into categories: Direct (null/empty), Social (instagram.com, facebook.com, etc.), Search (google.com, bing.com), Other Referral (everything else)
2. Show category-level bar chart with drill-down to individual referrers within each category
3. Per-referrer engagement quality: avg events per session for visitors from that source

**What already exists:** The visits page already shows "Top Referrers" with hostname extraction. This feature enhances it with categorization and engagement correlation.

**Confidence:** HIGH -- referrer data exists on every visit row.

### Time on Page (Estimated) -- Detail

**How it works in real tools:**
- Traditional GA: diff between timestamp of current page_view and next page_view. Fatal flaw: last page in session has no "next" event, so time = 0.
- GA4 improvement: uses engagement_time based on page visibility API + heartbeat pings every 10 seconds.
- Pendo: calculates from page entry/exit events, with idle timeout.

**What to build:**
1. Calculate time-on-page from consecutive events within the same session_id, using created_at timestamps
2. Display as "Avg time on site per session" (total session duration / sessions)
3. Display as "Avg time per page" where calculable
4. Acknowledge the last-page-problem in the UI: "Estimated from event timestamps. Last page of each session excluded from averages."

**Why NOT to add heartbeat tracking:**
- The Shrike sites are photo galleries. Visitors browse, download, leave. Session durations are short.
- Adding heartbeat events would dramatically increase visits table row count for minimal insight at this scale.
- The timestamp-diff approach gives "good enough" estimates for an admin tool.

**Confidence:** HIGH -- purely derived from existing data.

### Geographic Visitor List (Enhanced) -- Detail

**What already exists:** The visits page shows "Visits by Location" as a text list with progress bars showing country/city pairs ranked by count.

**What to add:**
1. Move to ShrikeAnalytics page for unified analytics view (or keep in both places)
2. Show unique sessions per location, not just row counts
3. Add percentage of total

**Why NOT a map visualization (yet):** See Differentiators section below.

**Confidence:** HIGH -- country/city data already exists and is displayed.

---

## Differentiators

Features that add value but are not essential for v1.3. Build if time permits.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Geographic dot map | Visual map is more intuitive than text list for location data | **Medium** | `react-simple-maps` package (~50KB) | SVG-based, no API key needed; but country/city needs lat/lng lookup |
| Scroll depth tracking + display | Shows how far visitors scroll in galleries; measures content engagement | **Medium-High** | **Requires Shrike client-side changes** + new events in visits table |
| Referrer-to-conversion correlation | Shows which referrers produce leads, not just visits | **Low** | Existing visits + leads tables | Join on session_id or ip_address between visits and leads |
| Session duration distribution | Histogram of session lengths reveals engagement patterns | **Low** | Derived from session journey work | Bucket sessions into <30s, 30s-2m, 2m-5m, 5m+ |
| Event heatmap (time of day/day of week) | When do visitors come? Useful for promo timing | **Low** | Existing created_at data | Grid heatmap: 7 rows (days) x 24 cols (hours) |

### Geographic Dot Map -- Detail

**Options researched:**

| Library | API Key? | Size | Maintenance | Fit |
|---------|----------|------|-------------|-----|
| react-simple-maps | No | ~50KB + TopoJSON (~300KB) | Low maintenance (not actively developed) | Best for simple static maps |
| Google Maps React | Yes (paid) | Heavy | Active | Overkill |
| Leaflet + react-leaflet | No (uses OpenStreetMap tiles) | ~40KB + tile loading | Active | Good but requires tile server |

**The hard problem:** The visits table stores `country` and `city` as strings, not coordinates. To place dots on a map, you need lat/lng. Options:
1. **Geocode at display time** -- API call per unique city. Slow, rate-limited, requires API key.
2. **Geocode at ingest time** -- Add lat/lng to edge function. Better but changes the tracking pipeline.
3. **Country-level choropleth only** -- Color countries by visit count. No city precision needed. Simplest.
4. **Static city lookup table** -- Maintain a JSON map of known city names to coordinates. Works for the ~10-20 unique cities in the data.

**Recommendation:** Start with country-level choropleth using react-simple-maps. At ~500 visits across probably 5-10 countries, a choropleth is clean and simple. City-level precision adds complexity for minimal insight at this scale.

**Confidence:** MEDIUM -- react-simple-maps works but is not actively maintained. Need to verify it builds cleanly with Next.js 14.

### Scroll Depth Tracking -- Detail

**Industry standard milestones:** 25%, 50%, 75%, 100% (used by GA4, GTM, Plausible, Semrush). Some tools track every percentage point; that is overkill.

**Implementation requires TWO changes:**
1. **Shrike client-side:** Add scroll listener in `useNessusTracking` that fires `trackEvent('scroll_depth', { depth: 25 })` at each milestone. Use IntersectionObserver or scroll percentage calculation. Fire once per milestone per page per session.
2. **CRM dashboard:** New visualization showing scroll depth distribution (how many sessions reached each milestone).

**Why this is Medium-High complexity:**
- Cross-repo change (Shrike + CRM)
- Scroll tracking has edge cases: dynamically loaded content (gallery_load_more changes page height), resize events, fast-scroll debouncing
- The Shrike galleries use infinite scroll / load-more, which means "100% scroll" is ambiguous -- 100% of what? The initially loaded content? All loaded content?

**Risk:** The load-more pattern makes scroll depth percentages misleading. A user who loads more content and scrolls through it might register as "50%" when they actually consumed more content than someone who saw all of a short page at "100%".

**Confidence:** MEDIUM -- the tracking is straightforward for static pages, but Shrike's dynamic content loading creates edge cases that could produce confusing metrics.

---

## Anti-Features

Features to explicitly NOT build. These are common in analytics products but wrong for this context.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| DOM session replay (PostHog-style) | Requires capturing every DOM mutation, massive data volume, complex player UI. At 500 visits for a 1-2 person tool, watching replay videos is a terrible use of time. | Session event timeline (shows the same journey info as structured data). |
| Real-time live visitor count | Requires WebSocket or SSE, persistent connection, server-side state. For 1-2 concurrent visitors, this is meaningless. | The existing 30-second polling is more than sufficient. |
| Predictive analytics / ML | Insufficient data volume (~500 visits) for any meaningful prediction. Classic premature optimization. | Simple aggregates and trends tell the full story at this scale. |
| A/B test integration | No A/B tests are running on the Shrike sites. Building analytics for hypothetical tests is waste. | If A/B testing starts, revisit. |
| Cohort analysis / retention curves | Retention analysis requires user identity across sessions. Shrike visitors are anonymous (session_id resets). The sites are event galleries, not recurring products. | Session-level analysis is the right granularity. |
| Full UTM parameter tracking on visits | The leads table already captures UTMs via the embed form. Adding UTM parsing to every page view creates redundant data collection. Shrike gallery links are shared on social media without UTMs anyway. | Use referrer hostname for visit attribution; UTMs for lead attribution. |
| Heartbeat / ping-based time tracking | Would multiply visits table rows by 10-20x for marginal accuracy improvement on time-on-page. At ~500 visits, storage is cheap but query complexity grows. | Timestamp-diff estimation from existing events. |
| Funnel conversion rate optimization | Already have an engagement funnel (visit > promo > lead form > submit). Building conversion rate optimization tooling implies iteration velocity that does not exist for occasional event galleries. | The existing funnel visualization is sufficient. |
| Custom dashboard builder / drag-and-drop | Admin tools used by 1-2 people do not need configurable layouts. Hard-coded sections are faster to build and maintain. | Fixed layout with sensible defaults. |

---

## Feature Dependencies

```
Existing Data (visits table)
    |
    +---> Session Journey Timeline
    |         |
    |         +---> Session Duration Distribution (derived)
    |         +---> Time on Page Estimates (derived)
    |
    +---> Referrer Analysis with Grouping
    |         |
    |         +---> Referrer-to-Conversion Correlation (needs leads join)
    |
    +---> Geographic Visitor List (enhanced)
    |         |
    |         +---> Geographic Dot Map (needs react-simple-maps + coord lookup)
    |
    +---> Event Heatmap (time of day / day of week)

New Client-Side Tracking Required
    |
    +---> Scroll Depth Events (Shrike changes)
              |
              +---> Scroll Depth Dashboard Display (CRM changes)
```

Key insight: **four of five target features can be built entirely from existing data.** Only scroll depth tracking requires changes to the Shrike tracking hook.

---

## MVP Recommendation

For v1.3 MVP, prioritize in this order:

1. **Session journey timeline** -- This is the headline feature and the one that provides genuinely new insight. Everything else is enhancement of existing views.
2. **Referrer analysis with grouping** -- Low complexity, high value. Transforms raw URLs into actionable categories. Partially exists already.
3. **Time on page estimates** -- Low complexity, naturally falls out of session journey work (same data, same grouping).
4. **Geographic visitor list enhancement** -- Low complexity, improves existing view.

Defer to post-MVP (or later in v1.3 if time allows):
- **Geographic dot map**: Medium complexity, adds visual appeal but same information as enhanced list. Dependency on unmaintained library is a risk.
- **Scroll depth tracking**: Medium-high complexity, requires cross-repo changes, has edge cases with dynamic content loading. Could be its own mini-milestone.
- **Event heatmap**: Low complexity but low priority -- interesting but not actionable at this scale.

---

## Sources

**Session journey/replay:**
- [PostHog Session Replay review](https://userpilot.com/blog/posthog-session-replay/) -- MEDIUM confidence
- [PostHog Session Recordings guide](https://visionlabs.com/academy/posthog/session-recordings/) -- MEDIUM confidence
- [Recharts Sankey API](https://recharts.github.io/en-US/api/Sankey/) -- HIGH confidence (official docs)

**Geographic visualization:**
- [Heatmaps vs Choropleths](https://www.standardco.de/notes/heatmaps-vs-choropleths) -- MEDIUM confidence
- [react-simple-maps](https://www.react-simple-maps.io/) -- HIGH confidence (official site)
- [react-simple-maps npm](https://www.npmjs.com/package/react-simple-maps) -- HIGH confidence (npm registry)

**Referrer analysis:**
- [Plausible docs: Acquisition channels](https://plausible.io/docs/top-referrers) -- HIGH confidence (official docs)
- [GA4 UTM parameter guide](https://cxl.com/blog/utm-parameters/) -- MEDIUM confidence
- [Plausible UTM tracking](https://plausible.io/blog/utm-tracking-tags) -- HIGH confidence (official blog)

**Scroll depth:**
- [Plausible scroll depth tracking](https://plausible.io/blog/scroll-depth-tracking) -- HIGH confidence (official blog)
- [GA4 scroll depth tracking](https://www.semrush.com/blog/google-analytics-scroll-depth/) -- MEDIUM confidence
- [Scroll depth as KPI](https://agencyanalytics.com/kpi-definitions/scroll-depth) -- MEDIUM confidence

**Time on page:**
- [Time tracking approaches](https://medium.com/analytics-and-data/effective-approaches-to-dealing-with-tracking-time-spent-on-content-and-webpages-695f63c02b8a) -- MEDIUM confidence
- [GA4 time on page explained](https://help.analyticsedge.com/article/misunderstood-metrics-time-on-page-session-duration/) -- MEDIUM confidence
- [Matomo heartbeat FAQ](https://matomo.org/faq/how-to/faq_21824/) -- HIGH confidence (official docs)
