# Phase 5: Shrike Website Consolidation - Research

**Researched:** 2026-02-13
**Domain:** Multi-tenant data consolidation, dashboard UI redesign
**Confidence:** MEDIUM

## Summary

Phase 5 consolidates two separate clients ("2016 Night at Press Club" and "Rosemont Vineyard") into a single "Shrike Website" client while preserving per-site visit identity and redesigning the visits dashboard to show all website metrics in a single view with per-site cards.

The standard approach involves a three-part solution: (1) database migration to add a site identifier column and update foreign keys, (2) RLS policy updates to maintain security under the new structure, and (3) UI refactoring to display per-site metrics in card-based layouts using existing Tailwind patterns.

Key technical decisions revolve around whether to add a dedicated `website_label` column versus using JSONB, how to handle the migration without data loss, and how to structure the dashboard UI for optimal UX when displaying multiple sites' metrics simultaneously.

**Primary recommendation:** Add a `website_label` TEXT column to the visits table, migrate data via SQL UPDATE statements with foreign key updates, and redesign the visits page with a card-based grid layout showing per-site metric cards.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | (Supabase) | Relational database | Already in use, excellent support for migrations and foreign keys |
| Supabase RLS | (Current) | Row-level security | Already configured, will need policy updates |
| Next.js 14 | 14.2.0 | App framework | Already in use, App Router for pages |
| Tailwind CSS | 3.4.0 | Styling | Already in use, excellent for responsive card grids |
| Recharts | 3.7.0 | Data visualization | Already in dependency tree for charts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562.0 | Icons | Already in use for UI icons |
| class-variance-authority | 0.7.1 | Component variants | Already in use, useful for card variants |
| clsx | 2.1.1 | Conditional classes | Already in use for dynamic styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TEXT column | JSONB field | JSONB more flexible but 30% more disk space and no query planner statistics, slower for frequent queries |
| SQL migration | Manual data export/import | SQL UPDATE is transactional and safer |
| Card grid | Tabs per site | Cards show all data at once (success criterion #4), tabs require clicking |

**Installation:**
No new dependencies required. All work uses existing stack.

## Architecture Patterns

### Recommended Database Schema Change

Add a column to distinguish which website each visit came from:

```sql
-- Migration: Add website_label column
ALTER TABLE visits
ADD COLUMN website_label TEXT;

-- Add index for query performance
CREATE INDEX idx_visits_website_label
ON visits(website_label);

-- Update RLS policies to include new column
-- (existing policies continue to filter by client_id)
```

**Why TEXT column over JSONB:**
- PostgreSQL doesn't keep statistics on JSONB values, leading to poor query planning
- Frequent queries on website_label (every page load) benefit from native column statistics
- 30% disk space savings compared to JSONB for structured data
- Simpler query syntax: `WHERE website_label = 'press-club'` vs. `WHERE settings->>'site' = 'press-club'`

Source: [When To Avoid JSONB In A PostgreSQL Schema](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)

### Pattern 1: Data Consolidation Migration

**What:** Consolidate multiple client records into a single parent client while preserving data identity

**When to use:** Merging related data sources that were previously separate tenants

**Migration steps:**
```sql
-- Step 1: Create new consolidated client
INSERT INTO clients (id, name, slug, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'Shrike Website',
  'shrike-website',
  true,
  NOW()
);

-- Step 2: Store the new client ID
WITH new_client AS (
  SELECT id FROM clients WHERE slug = 'shrike-website'
),
old_clients AS (
  SELECT id, name FROM clients
  WHERE slug IN ('2016-night-at-press-club', 'rosemont-vineyard')
)
-- Step 3: Update visits table with website_label based on old client_id
UPDATE visits
SET
  website_label = CASE
    WHEN client_id = (SELECT id FROM old_clients WHERE name = '2016 Night at Press Club')
      THEN 'press-club'
    WHEN client_id = (SELECT id FROM old_clients WHERE name = 'Rosemont Vineyard')
      THEN 'rosemont'
  END,
  client_id = (SELECT id FROM new_client)
WHERE client_id IN (SELECT id FROM old_clients);

-- Step 4: Deactivate old clients
UPDATE clients
SET is_active = false
WHERE slug IN ('2016-night-at-press-club', 'rosemont-vineyard');
```

**Key considerations:**
- Use transactions to ensure atomicity
- NOT NULL constraint on website_label must be added AFTER migration
- Foreign key constraints remain valid (client_id still points to valid client)
- RLS policies continue to work (filtering by client_id)

Source: [PostgreSQL Foreign Key](https://neon.com/postgresql/postgresql-tutorial/postgresql-foreign-key), [PostgreSQL UPDATE Statement](https://www.postgresql.org/docs/current/sql-update.html)

### Pattern 2: Per-Entity Card Grid Layout

**What:** Display metrics for multiple entities (websites) in a card-based grid layout

**When to use:** Dashboard needs to show comparable metrics across multiple data sources on one screen

**Structure:**
```tsx
// Visits page structure
<div className="container mx-auto p-6">
  <h1>Shrike Website Visitor Analytics</h1>

  {/* Per-site cards */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {websites.map(site => (
      <WebsiteCard
        key={site.label}
        websiteLabel={site.label}
        websiteName={site.name}
      />
    ))}
  </div>
</div>

// Each WebsiteCard contains full metrics
function WebsiteCard({ websiteLabel }) {
  // Query visits filtered by client_id AND website_label
  const visits = fetchVisits({
    clientId: currentClientId,
    websiteLabel
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2>{websiteName}</h2>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Visits" value={stats.totalVisits} />
        <StatCard label="Unique IPs" value={stats.uniqueIPs} />
        <StatCard label="Sessions" value={stats.uniqueSessions} />
      </div>

      {/* Location stats */}
      <LocationChart data={locationStats} />

      {/* Top pages */}
      <TopPages data={pageStats} />

      {/* Referrers */}
      <TopReferrers data={referrerStats} />

      {/* Time series */}
      <VisitsOverTime data={dailyStats} />
    </div>
  )
}
```

**Responsive design:**
- Mobile (< 1024px): Single column, cards stack vertically
- Desktop (>= 1024px): Two columns, cards side-by-side
- Use `max-h-[600px] overflow-y-auto` if individual cards get too tall

Source: [17 Card UI Design Examples](https://www.eleken.co/blog-posts/card-ui-examples-and-best-practices-for-product-owners), [Dashboard Design Best Practices](https://www.justinmind.com/ui-design/dashboard-design-best-practices-ux)

### Pattern 3: Query Optimization for Multi-Site

**What:** Filter queries by both client_id AND website_label

**When to use:** Fetching data for a specific website within a consolidated client

**Example:**
```tsx
// Before (Phase 4 and earlier)
const addClientFilter = (query) => {
  if (currentClientId) {
    return query.eq('client_id', currentClientId)
  }
  return query
}

// After (Phase 5)
const addSiteFilter = (query, websiteLabel) => {
  let filtered = query
  if (currentClientId) {
    filtered = filtered.eq('client_id', currentClientId)
  }
  if (websiteLabel) {
    filtered = filtered.eq('website_label', websiteLabel)
  }
  return filtered
}

// Usage
let visitsQuery = supabase.from('visits').select('ip_address, session_id')
visitsQuery = addSiteFilter(visitsQuery, 'press-club')
const { data: visitsData } = await visitsQuery
```

**Performance notes:**
- Composite index on (client_id, website_label) recommended for optimal query performance
- RLS policies evaluate first (client_id filter), then application filter (website_label)
- Each website card queries independently (parallelizable on client)

### Anti-Patterns to Avoid

- **Don't fetch all visits then filter in JavaScript:** This loads unnecessary data and is slow. Always filter at the database level with WHERE clauses.
- **Don't use JSONB for frequently-queried categorization:** PostgreSQL query planner can't optimize JSONB lookups effectively. Use dedicated columns for fields queried on every page load.
- **Don't hard-code website labels in components:** Define them in a constant array and iterate. This makes adding future sites trivial.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data migration script | Custom Node.js script to read/update records | SQL migration with UPDATE statements | Transactional, handles foreign keys correctly, can be rolled back |
| Card grid responsive behavior | Custom media query logic in components | Tailwind's responsive grid classes (`grid-cols-1 lg:grid-cols-2`) | Battle-tested, accessible, works across browsers |
| Multi-site query filtering | Custom query builder abstraction | Simple helper function extending existing pattern | Existing codebase already uses `addClientFilter` pattern, extend it |
| Layout animations for cards | Custom CSS transitions | Tailwind's built-in transition utilities | Performant, consistent, already loaded |

**Key insight:** This phase is primarily a refactoring task using existing tools. The visits page already displays all the metrics needed—the work is reorganizing them by website rather than by client, and updating the database schema to support this distinction.

## Common Pitfalls

### Pitfall 1: Losing Visit Data During Migration

**What goes wrong:** If the UPDATE statement fails partway through or the website_label mapping is incorrect, visits could be assigned to the wrong site or lost entirely.

**Why it happens:** Complex multi-step migrations without transactions, incorrect WHERE clause logic, or not backing up data first.

**How to avoid:**
- Wrap entire migration in a transaction (BEGIN...COMMIT)
- Test migration on a copy of production data in development first
- Verify counts before and after: `SELECT client_id, COUNT(*) FROM visits GROUP BY client_id`
- Keep old clients as `is_active = false` rather than deleting them (allows rollback)

**Warning signs:**
- Visit counts don't match before/after
- NULL values in website_label column after migration
- RLS policy errors when querying visits

### Pitfall 2: Breaking Existing RLS Policies

**What goes wrong:** Adding a new column and updating client_id could inadvertently break RLS policies if they have strict column checks or if the policy logic depends on the old client_id values.

**Why it happens:** RLS policies are evaluated at the database level and may have logic that assumes each visit belongs to a unique client.

**How to avoid:**
- Review existing RLS policies on visits table before migration
- Test RLS behavior after migration with different user roles
- Ensure policies continue to filter by client_id (they should work identically after migration since client_id is still present and points to valid client)

**Warning signs:**
- "permission denied for table visits" errors after migration
- Users seeing visits from other clients
- Admin users unable to see consolidated data

### Pitfall 3: Performance Degradation from Unindexed Queries

**What goes wrong:** Querying by website_label without an index causes full table scans on the visits table, which can be slow with thousands of records.

**Why it happens:** Adding a column without adding an index, or not realizing that compound filters (client_id + website_label) benefit from composite indexes.

**How to avoid:**
- Add index on website_label immediately after adding column
- Consider composite index: `CREATE INDEX idx_visits_client_website ON visits(client_id, website_label)`
- Use EXPLAIN ANALYZE to verify query plans use indexes

**Warning signs:**
- Visits page loads slowly (> 2 seconds)
- Database CPU spikes when loading visits page
- EXPLAIN shows "Seq Scan" instead of "Index Scan"

### Pitfall 4: UI Becomes Too Dense on Mobile

**What goes wrong:** Per-site cards with full metrics (overview stats, locations, pages, referrers, time series) become overwhelming on mobile screens, requiring excessive scrolling.

**Why it happens:** Each card is essentially a full dashboard page, and two cards stacked vertically is a lot of content.

**How to avoid:**
- Test on actual mobile device (not just responsive browser)
- Consider collapsible sections within cards on mobile (e.g., time series starts collapsed)
- Use `max-h-[600px] overflow-y-auto` on card sections that are detail-heavy
- Prioritize most important metrics at top of each card (overview stats, then detailed breakdowns)

**Warning signs:**
- User feedback about "too much scrolling"
- Mobile viewport requires 3+ full-page scrolls to see both sites
- Cards overlap or layout breaks on small screens

### Pitfall 5: Hard-Coding Website Labels

**What goes wrong:** Website labels ('press-club', 'rosemont') are hard-coded in components, making it difficult to add new sites later or change labels.

**Why it happens:** Quick implementation without thinking about extensibility.

**How to avoid:**
```tsx
// Define websites as configuration
const WEBSITES = [
  { label: 'press-club', name: '2016 Night at Press Club', url: 'https://pressclub.example' },
  { label: 'rosemont', name: 'Rosemont Vineyard', url: 'https://rosemont.example' }
]

// Iterate over configuration
{WEBSITES.map(site => (
  <WebsiteCard key={site.label} {...site} />
))}
```

**Warning signs:**
- Copy-pasted components for each website
- Need to edit multiple files to add a new site
- Inconsistent styling between website cards

## Code Examples

Verified patterns from official sources and current codebase:

### Migration SQL (Complete Transaction)

```sql
-- Source: PostgreSQL official documentation + project requirements
BEGIN;

-- Create new consolidated client
INSERT INTO clients (id, name, slug, is_active, created_at)
VALUES (gen_random_uuid(), 'Shrike Website', 'shrike-website', true, NOW())
RETURNING id;

-- Store for reference (note: in actual execution, capture this ID)
-- Assuming new client ID is 'abc-123' and old client IDs are known

-- Update visits to new client and add website_label
UPDATE visits
SET
  website_label = CASE
    WHEN client_id = 'old-press-club-id' THEN 'press-club'
    WHEN client_id = 'old-rosemont-id' THEN 'rosemont'
  END,
  client_id = 'new-shrike-website-id'
WHERE client_id IN ('old-press-club-id', 'old-rosemont-id');

-- Verify counts match
DO $$
DECLARE
  old_count INT;
  new_count INT;
BEGIN
  SELECT COUNT(*) INTO old_count FROM visits
  WHERE website_label IN ('press-club', 'rosemont');

  SELECT COUNT(*) INTO new_count FROM visits
  WHERE client_id = 'new-shrike-website-id';

  IF old_count != new_count THEN
    RAISE EXCEPTION 'Visit counts do not match: % vs %', old_count, new_count;
  END IF;
END $$;

-- Add NOT NULL constraint (after data is populated)
ALTER TABLE visits
ALTER COLUMN website_label SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_visits_website_label ON visits(website_label);
CREATE INDEX idx_visits_client_website ON visits(client_id, website_label);

-- Deactivate old clients (DO NOT DELETE - allows rollback)
UPDATE clients
SET is_active = false
WHERE slug IN ('2016-night-at-press-club', 'rosemont-vineyard');

COMMIT;
```

### Visits Page Component Structure

```tsx
// Source: Current codebase pattern + card grid best practices
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

// Website configuration
const WEBSITES = [
  { label: 'press-club', name: '2016 Night at Press Club' },
  { label: 'rosemont', name: 'Rosemont Vineyard' }
] as const

interface VisitStats {
  totalVisits: number
  uniqueIPs: number
  uniqueSessions: number
}

export default function VisitsPage() {
  const { isAdmin, currentClientId } = useUser()
  const supabase = createClient()

  // Non-admin users must have a client selected
  if (!isAdmin && !currentClientId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Select a client to view visitor analytics</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Shrike Website Visitor Analytics
      </h1>

      {/* Per-site cards in responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {WEBSITES.map(site => (
          <WebsiteCard
            key={site.label}
            websiteLabel={site.label}
            websiteName={site.name}
            currentClientId={currentClientId}
            supabase={supabase}
          />
        ))}
      </div>
    </div>
  )
}

function WebsiteCard({
  websiteLabel,
  websiteName,
  currentClientId,
  supabase
}: {
  websiteLabel: string
  websiteName: string
  currentClientId: string | null
  supabase: any
}) {
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    // Helper to add filters
    const addFilters = <T,>(query: T): T => {
      let filtered = query as any
      if (currentClientId) {
        filtered = filtered.eq('client_id', currentClientId)
      }
      filtered = filtered.eq('website_label', websiteLabel)
      return filtered
    }

    // Fetch visits for this website
    let visitsQuery = supabase.from('visits').select('ip_address, session_id')
    visitsQuery = addFilters(visitsQuery)
    const { data: visitsData } = await visitsQuery

    if (visitsData) {
      const uniqueIPs = new Set(visitsData.map((v) => v.ip_address).filter(Boolean))
      const uniqueSessions = new Set(visitsData.map((v) => v.session_id).filter(Boolean))

      setStats({
        totalVisits: visitsData.length,
        uniqueIPs: uniqueIPs.size,
        uniqueSessions: uniqueSessions.size,
      })
    }

    // TODO: Fetch other metrics (locations, pages, referrers, time series)
    // Using same pattern with addFilters()

    setLoading(false)
  }, [supabase, currentClientId, websiteLabel])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Header */}
      <h2 className="text-xl font-semibold text-gray-900">{websiteName}</h2>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Visits" value={stats?.totalVisits || 0} color="blue" />
        <StatCard label="Unique IPs" value={stats?.uniqueIPs || 0} color="green" />
        <StatCard label="Sessions" value={stats?.uniqueSessions || 0} color="purple" />
      </div>

      {/* Additional sections for locations, pages, referrers, time series */}
      {/* Follow same pattern as current visits page but scoped to this website */}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-900',
    green: 'bg-green-100 text-green-900',
    purple: 'bg-purple-100 text-purple-900',
  }

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  )
}
```

### Helper Function for Multi-Filter Queries

```tsx
// Source: Extending current codebase pattern
// Current: addClientFilter (single filter)
// New: addSiteFilters (multiple filters)

const addSiteFilters = <T,>(
  query: T,
  currentClientId: string | null,
  websiteLabel?: string
): T => {
  let filtered = query as any

  // Client filter (RLS layer)
  if (currentClientId) {
    filtered = filtered.eq('client_id', currentClientId)
  }

  // Website filter (application layer)
  if (websiteLabel) {
    filtered = filtered.eq('website_label', websiteLabel)
  }

  return filtered
}

// Usage in components
let visitsQuery = supabase.from('visits').select('ip_address, session_id')
visitsQuery = addSiteFilters(visitsQuery, currentClientId, 'press-club')
const { data } = await visitsQuery
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate clients per website | Consolidated client with sub-categorization | 2026 (Phase 5) | Reduces sidebar clutter, allows single-screen comparison |
| Switch between clients to compare | View all sites simultaneously | 2026 (Phase 5) | Faster insights, better UX |
| JSONB for flexible schema | Dedicated columns for frequent queries | Ongoing best practice | 30% disk savings, better query performance |
| Tabs for multi-entity views | Card grids | Modern dashboard UX | All data visible at once, no clicking required |

**Deprecated/outdated:**
- Per-client navigation for related sites: Now consolidated under single client with per-site cards

## Open Questions

Things that couldn't be fully resolved:

1. **Are there other tables besides visits that need migration?**
   - What we know: Visits table contains visit tracking data. Leads, orders, and other tables likely have their own client_id references.
   - What's unclear: Whether "2016 Night at Press Club" and "Rosemont Vineyard" clients have any leads or orders data that also needs consolidation.
   - Recommendation: Query leads and orders tables filtered by old client IDs. If empty, no migration needed. If present, decide whether to consolidate or keep separate (requirements only mention visits consolidation).

2. **How does the embed/tracking script identify which website sent the visit?**
   - What we know: Visits table stores ip_address, session_id, country, city, page_path, referrer, client_id. The embed page exists at `/embed?client_id=X`.
   - What's unclear: Is there currently a mechanism that distinguishes Press Club visits from Rosemont visits, or do they just use different client_ids?
   - Recommendation: Investigate how visits are currently created. If tracking script is embedded on each website with different client_id query params, that's the distinction mechanism. After consolidation, tracking script would need to pass a site identifier (e.g., `?client_id=shrike&site=press-club`).

3. **Should website_label be user-editable or fixed?**
   - What we know: website_label will be set during migration ('press-club', 'rosemont')
   - What's unclear: If a visit gets attributed to the wrong site, should users be able to change it? Or is it immutable once set?
   - Recommendation: Start with immutable (no UI to change it). If there are frequent mis-attributions, add an admin-only edit feature later. Keep it simple for v1.

4. **What if more websites are added to Shrike later?**
   - What we know: WEBSITES configuration array makes adding sites easy in the UI
   - What's unclear: Is there a self-service flow for creating new website labels, or does it require a database migration each time?
   - Recommendation: For MVP, adding a new site requires code change (update WEBSITES array) and ensuring tracking script passes correct site parameter. Future enhancement could make this admin-configurable via clients.settings JSONB.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL UPDATE Documentation](https://www.postgresql.org/docs/current/sql-update.html) - Official UPDATE statement syntax
- [PostgreSQL Foreign Keys Tutorial](https://www.postgresql.org/docs/current/tutorial-fk.html) - Foreign key concepts and CASCADE behavior
- [Supabase Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS patterns for multi-tenant apps
- Current codebase: visits/page.tsx, ClientAccordion.tsx, UserContext.tsx - Existing patterns for client filtering and visit display

### Secondary (MEDIUM confidence)
- [When To Avoid JSONB In A PostgreSQL Schema | Heap](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) - Column vs JSONB performance comparison
- [Supabase RLS Best Practices | MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) - Multi-tenant isolation patterns
- [Multi-Tenant App with Next.js and Supabase | Medium](https://medium.com/@gg.code.latam/multi-tenant-app-with-next-js-14-app-router-supabase-vercel-cloudflare-2024-3bbbb42ee914) - Multi-tenant architecture guidance
- [17 Card UI Design Examples | Eleken](https://www.eleken.co/blog-posts/card-ui-examples-and-best-practices-for-product-owners) - Card-based dashboard patterns
- [Dashboard Design Best Practices | Justinmind](https://www.justinmind.com/ui-design/dashboard-design-best-practices-ux) - Multi-source dashboard layouts

### Tertiary (LOW confidence)
- [How to Track Multiple Websites on an Analytics Dashboard | Cyfe](https://www.cyfe.com/blog/track-multiple-websites-analytics-dashboard/) - Multi-site analytics concepts (generic, not specific to implementation)
- [PostgreSQL Data Migration Tools | Airbyte](https://airbyte.com/top-etl-tools-for-sources/postgres-migration-tool) - Migration tool overview (not needed for this simple migration)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies, no new libraries needed
- Architecture: MEDIUM - Migration pattern is standard but testing required for data integrity
- Pitfalls: MEDIUM - Based on PostgreSQL best practices and common migration issues

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days for stable technologies, schema migration patterns don't change rapidly)
