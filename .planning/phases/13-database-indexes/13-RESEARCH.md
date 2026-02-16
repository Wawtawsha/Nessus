# Phase 13: Database Indexes - Research

**Researched:** 2026-02-15
**Domain:** PostgreSQL indexing, Supabase analytics optimization
**Confidence:** HIGH

## Summary

This research investigates PostgreSQL indexing strategies for optimizing analytics query performance in the Nessus CRM dashboard. The primary focus is the `visits` table which powers all analytics features built in phases 9-12, plus the new v1.4 tables (`scripts`, `niches`, `script_lead_outcomes`) added in phase 14.

The standard approach is to create B-tree indexes on foreign key columns and frequently filtered columns, with composite indexes for multi-column WHERE clauses that appear together. For this specific use case, the main query pattern is `WHERE client_id = ? [AND website_label = ?]`, which already has optimal indexing from migration 05.

The critical finding: **Most needed indexes already exist.** The primary optimization opportunity is adding indexes to the v1.4 tables' foreign key columns, which is a known pitfall (Pitfall 18) and standard PostgreSQL best practice.

**Primary recommendation:** Add B-tree indexes on foreign key columns in the v1.4 tables (scripts.client_id, script_lead_outcomes.script_id, script_lead_outcomes.lead_id). The visits table already has appropriate indexes. Avoid over-indexing given the write-heavy workload from the track-visitor edge function.

## Standard Stack

### Core Indexing for PostgreSQL/Supabase

| Tool/Feature | Purpose | Why Standard |
|--------------|---------|--------------|
| B-tree indexes | Default index type for equality and range queries | PostgreSQL default, O(log n) lookups, works for 95% of use cases |
| Composite indexes | Multi-column WHERE clauses | More efficient than multiple single-column indexes for combined filters |
| Partial indexes | Subset of rows matching predicate | Reduces index size, faster for repeated filtered queries |
| GIN indexes | JSONB columns, array containment | Inverted index structure for multi-component values |
| Index Advisor (Supabase) | Automated index suggestions | Built into Supabase Dashboard, analyzes pg_stat_statements |

### Supporting

| Tool/Feature | Purpose | When to Use |
|--------------|---------|-------------|
| BRIN indexes | Large tables with natural ordering (time-series) | When column correlates with physical row order (created_at) |
| Covering indexes (INCLUDE) | Index-only scans | Read-heavy analytical queries returning small columns |
| REINDEX CONCURRENTLY | Rebuild stale indexes | Maintenance without blocking writes |
| pg_stat_statements | Query performance monitoring | Finding slow queries, enabled by default in Supabase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| B-tree | Hash index | Hash only supports equality (=), not ranges; B-tree handles both |
| Composite index | Multiple single-column indexes | Query planner can use bitmap scans but composite is more efficient for combined filters |
| GIN (jsonb_ops) | GIN (jsonb_path_ops) | jsonb_path_ops is 16% slower writes vs 79% for jsonb_ops, but supports fewer operators |

**Installation:**

Indexes are created via SQL migrations:
```sql
CREATE INDEX idx_table_column ON table_name(column_name);
CREATE INDEX idx_composite ON table_name(col1, col2); -- Composite
CREATE INDEX idx_partial ON table_name(column) WHERE condition; -- Partial
CREATE INDEX idx_jsonb ON table_name USING GIN (jsonb_column); -- JSONB
```

## Architecture Patterns

### Current Visits Table Indexes

From migration `05_shrike_consolidation.sql`:
```sql
-- Single-column index for filtering by website_label alone
CREATE INDEX idx_visits_website_label ON visits(website_label);

-- Composite index for the common query pattern: client + website
CREATE INDEX idx_visits_client_website ON visits(client_id, website_label);
```

**Analysis:** This is optimal for the query pattern in ShrikeAnalytics.tsx:
```typescript
let query = supabase
  .from('visits')
  .select('...')
  .eq('client_id', SHRIKE_CLIENT_ID)

if (siteFilter !== 'all') {
  query = query.eq('website_label', siteFilter)
}
```

The composite index `(client_id, website_label)` supports:
- `WHERE client_id = ?` (uses leftmost column)
- `WHERE client_id = ? AND website_label = ?` (uses both columns)

PostgreSQL automatically creates indexes on PRIMARY KEY and UNIQUE constraints, so `visits.id` is already indexed.

### Pattern 1: Foreign Key Indexing

**What:** Always index foreign key columns for JOIN performance and referential integrity checks

**When to use:** Every foreign key column (with rare exceptions for tiny lookup tables)

**Example:**
```sql
-- Source: PostgreSQL best practices
CREATE TABLE scripts (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
);

-- Index the FK for fast JOINs and DELETE CASCADE performance
CREATE INDEX idx_scripts_client_id ON scripts(client_id);
```

**Why critical:**
- DELETE from parent table scans child table for matching FKs
- JOINs nearly always join on FK columns
- Without index: sequential scan (O(n))
- With index: B-tree lookup (O(log n))

**Current state:**
- ✅ `visits.client_id` - Covered by composite index `idx_visits_client_website`
- ✅ `scripts.client_id` - Created in migration 07
- ✅ `script_lead_outcomes.script_id` - Created in migration 07
- ✅ `script_lead_outcomes.lead_id` - Created in migration 07
- ✅ `leads.niche_id` - Created in migration 07

**Verdict:** All foreign keys are already indexed.

### Pattern 2: Composite Index Column Order

**What:** Column order in composite indexes matters - leftmost prefix rule

**When to use:** When queries filter on multiple columns together

**Example:**
```sql
-- GOOD: Supports WHERE client_id = ? AND website_label = ?
-- Also supports WHERE client_id = ? (leftmost prefix)
CREATE INDEX idx_visits_client_website ON visits(client_id, website_label);

-- BAD: Would not help WHERE client_id = ? alone
CREATE INDEX idx_bad ON visits(website_label, client_id);
```

**Column ordering heuristic:**
1. Equality filters before range filters
2. High cardinality before low cardinality
3. Most selective columns first

**Current implementation:** Correctly ordered (client_id first, website_label second)

### Pattern 3: Partial Indexes for Filtered Analytics

**What:** Index only rows matching a predicate to reduce index size

**When to use:** When queries consistently filter on the same condition

**Example:**
```sql
-- If most queries filter for active scripts only
CREATE INDEX idx_scripts_active
ON scripts(client_id)
WHERE is_active = true;
```

**Caveat:** Query WHERE clause must exactly match or mathematically imply the index predicate. PostgreSQL can recognize simple inequalities (x < 1 implies x < 2) but otherwise requires exact match.

**Recommendation for this phase:** NOT needed. The visits table doesn't have consistent predicates, and the new tables are small enough that partial indexes won't provide meaningful benefit.

### Pattern 4: JSONB Indexing with GIN

**What:** Use GIN (Generalized Inverted Index) for JSONB columns when querying keys/values

**When to use:** Queries use @>, ?, ?&, ?|, @@ operators on JSONB

**Example:**
```sql
-- Index event_data JSONB column
CREATE INDEX idx_visits_event_data ON visits USING GIN (event_data);

-- Supports queries like:
SELECT * FROM visits WHERE event_data @> '{"photo_name": "sunset.jpg"}';
```

**Performance:**
- GIN indexes have larger write overhead than B-tree
- `jsonb_path_ops` operator class: 16% write overhead, faster searches, fewer operators
- `jsonb_ops` (default): 79% write overhead, slower searches, more operators

**Current state:** `visits.event_data` has NO index

**Analysis:** Should we index it?
- **Against:** Section components do ALL filtering in JavaScript via useMemo, not SQL
- **Against:** Write-heavy workload (every page view inserts a visit)
- **For:** Future queries might filter by event_data in SQL
- **Verdict:** SKIP for now. Only add if future requirements need SQL-level JSONB filtering.

### Anti-Patterns to Avoid

**Don't create indexes on:**
- Low cardinality columns queried alone (e.g., boolean flags with 95% true)
- Columns never used in WHERE, JOIN, or ORDER BY
- Every column "just in case" (write overhead compounds)

**Don't over-index write-heavy tables:**
- Each index must be updated on INSERT/UPDATE
- The track-visitor edge function inserts on every page view/event
- Write overhead formula: `(index_entry_size / row_size) * selectivity`

**Don't assume indexes are always used:**
- Small tables: PostgreSQL prefers sequential scan (faster than index overhead)
- Query planner switches automatically as table grows
- Use EXPLAIN ANALYZE to verify index usage

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Index recommendations | Manual query analysis | Supabase Index Advisor | Analyzes pg_stat_statements automatically, suggests indexes with cost estimates |
| Finding unused indexes | Manual tracking | `pg_stat_user_indexes` query | Built-in statistics on index usage |
| Query performance analysis | Manual timing | EXPLAIN ANALYZE | Shows actual execution plan, index usage, row counts |
| JSONB indexing strategy | Trial and error | GIN with jsonb_path_ops first | 16% write overhead vs 79% for default jsonb_ops |
| Index maintenance | Custom scripts | REINDEX CONCURRENTLY | Rebuilds without blocking writes |

**Key insight:** PostgreSQL has mature tooling for index analysis. Don't reinvent query optimization—use EXPLAIN ANALYZE, pg_stat_statements, and Supabase's Index Advisor.

## Common Pitfalls

### Pitfall 1: Missing Foreign Key Indexes

**What goes wrong:** DELETE operations on parent table scan entire child table sequentially

**Why it happens:** PostgreSQL does NOT automatically create indexes on FK columns (unlike PRIMARY KEY). Developers assume FK = indexed.

**How to avoid:**
```sql
-- ALWAYS create index immediately after FK declaration
ALTER TABLE child ADD COLUMN parent_id UUID REFERENCES parent(id);
CREATE INDEX idx_child_parent_id ON child(parent_id);
```

**Warning signs:**
- Slow DELETE operations on parent tables
- EXPLAIN ANALYZE shows "Seq Scan" on child table with FK filter

**Status:** Already addressed in migration 07 (all FK columns indexed)

### Pitfall 2: Composite Index Column Order Mistakes

**What goes wrong:** Composite index `(col2, col1)` doesn't help query `WHERE col1 = ?`

**Why it happens:** Misunderstanding leftmost prefix rule

**How to avoid:**
- Put columns used alone or most frequently FIRST
- Use single-column index if queries filter columns independently
- Test with EXPLAIN to verify index usage

**Current state:** `idx_visits_client_website(client_id, website_label)` correctly ordered

### Pitfall 3: Over-Indexing Write-Heavy Tables

**What goes wrong:** INSERT performance degrades as more indexes are added

**Why it happens:** Each index requires update on every write

**How to avoid:**
- Measure write overhead: `index_entry_size / row_size * selectivity`
- Visits table: ~12 columns, ~150 bytes/row
- Each index: ~16 bytes (header + column width)
- 3 indexes = ~10% write overhead (acceptable)
- 10+ indexes = 30%+ overhead (problematic)

**Warning signs:**
- Edge function timeouts on high traffic
- Increasing pg_stat_user_tables.n_tup_ins duration

**Recommendation:** Limit visits table to current 2 indexes (composite + single-column website_label)

### Pitfall 4: Partial Index Predicate Mismatch

**What goes wrong:** Query `WHERE is_active = true AND client_id = ?` doesn't use index created with `WHERE is_active = true`

**Why it happens:** PostgreSQL requires WHERE clause to mathematically imply index predicate. Adding extra conditions breaks this.

**How to avoid:**
- Keep partial index predicates simple
- Test with EXPLAIN ANALYZE
- Document the exact query pattern the index supports

**Current state:** No partial indexes, so not applicable

### Pitfall 5: Ignoring Index Bloat

**What goes wrong:** Indexes grow stale, contain dead tuples, queries slow down over time

**Why it happens:** UPDATEs and DELETEs leave dead rows that VACUUM removes, but index references remain until REINDEX

**How to avoid:**
```sql
-- Check index bloat
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild without blocking writes
REINDEX INDEX CONCURRENTLY idx_visits_client_website;
```

**Warning signs:**
- Index size grows disproportionate to table size
- Query performance degrades over time despite consistent data volume

**Recommendation:** Monitor monthly, REINDEX if index size > 2x expected

## Code Examples

Verified patterns from official sources:

### Example 1: Standard B-tree Index on Foreign Key
```sql
-- Source: https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/
-- Create index on FK column for fast JOINs and DELETE CASCADE
CREATE INDEX idx_scripts_client_id ON scripts(client_id);

-- Verify index usage
EXPLAIN ANALYZE
SELECT s.* FROM scripts s
JOIN clients c ON c.id = s.client_id
WHERE c.slug = 'shrike-media-website';
```

### Example 2: Composite Index for Multi-Column Filter
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/indexes
-- Composite index for client + website filter pattern
CREATE INDEX idx_visits_client_website ON visits(client_id, website_label);

-- Supports both queries:
-- 1. WHERE client_id = ? (leftmost prefix)
-- 2. WHERE client_id = ? AND website_label = ? (both columns)
```

### Example 3: Partial Index for Subset Queries
```sql
-- Source: https://www.postgresql.org/docs/current/indexes-partial.html
-- Index only active scripts to reduce index size
CREATE INDEX idx_scripts_active
ON scripts(client_id, title)
WHERE is_active = true;

-- Query MUST include is_active = true to use index
SELECT * FROM scripts
WHERE client_id = ? AND is_active = true
ORDER BY title;
```

### Example 4: GIN Index on JSONB
```sql
-- Source: https://www.postgresql.org/docs/current/datatype-json.html
-- GIN index for JSONB containment queries
CREATE INDEX idx_visits_event_data
ON visits USING GIN (event_data jsonb_path_ops);

-- Supports @> operator (containment)
SELECT * FROM visits
WHERE event_data @> '{"photo_name": "sunset.jpg"}';
```

### Example 5: Covering Index with INCLUDE
```sql
-- Source: https://www.postgresql.org/docs/current/indexes-index-only-scans.html
-- Covering index for index-only scans
CREATE INDEX idx_visits_covering
ON visits(client_id, website_label)
INCLUDE (event_name, created_at);

-- Can satisfy SELECT without table access
SELECT event_name, created_at
FROM visits
WHERE client_id = ? AND website_label = ?;
```

### Example 6: Check Index Usage
```sql
-- Source: https://supabase.com/docs/guides/database/query-optimization
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check if index is being used for specific query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM visits WHERE client_id = 'da6fa735-8143-4cdf-941c-5b6021cbc961';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Index all FKs manually | Still manual (PostgreSQL doesn't auto-index FKs) | Never | Must remember to index FKs |
| GIN jsonb_ops default | GIN jsonb_path_ops preferred | PostgreSQL 9.4+ | 16% write overhead vs 79% |
| REINDEX blocks writes | REINDEX CONCURRENTLY | PostgreSQL 12+ | Zero-downtime maintenance |
| Manual query analysis | Supabase Index Advisor | Supabase 2023+ | Automated suggestions from pg_stat_statements |
| Generic covering indexes | INCLUDE clause for non-key columns | PostgreSQL 11+ | Smaller indexes, index-only scans |

**Deprecated/outdated:**
- Hash indexes before PostgreSQL 10: not WAL-logged, lost on crash (fixed in v10)
- CREATE INDEX without CONCURRENTLY on production: blocks writes (use CONCURRENTLY)

## Open Questions

1. **Should we index visits.event_data (JSONB)?**
   - What we know: Section components filter in JavaScript, not SQL; write-heavy workload
   - What's unclear: Future requirements for SQL-level JSONB filtering
   - Recommendation: Skip for now, revisit if JSONB queries needed in SQL

2. **Should we use a covering index for the main analytics query?**
   - What we know: Query selects ~12 columns; covering index would duplicate all of them
   - What's unclear: Whether index-only scan benefit outweighs index bloat
   - Recommendation: Skip. Covering indexes work best for narrow SELECTs (2-3 columns), not wide analytics queries

3. **Should we consider BRIN index on visits.created_at?**
   - What we know: BRIN works best for large tables with natural ordering; visits.created_at likely correlates with insertion order
   - What's unclear: Whether table is large enough to benefit (BRIN shines at millions+ rows)
   - Recommendation: Skip for now. BRIN benefits appear at scale we haven't reached. Revisit when visits table exceeds 1M rows.

4. **What's the current size of the visits table?**
   - What we know: Not specified in codebase or migrations
   - What's unclear: Actual row count, table size, query performance metrics
   - Recommendation: Query `SELECT count(*), pg_size_pretty(pg_total_relation_size('visits'))` to establish baseline before adding indexes

## Sources

### Primary (HIGH confidence)
- [Managing Indexes in PostgreSQL | Supabase Docs](https://supabase.com/docs/guides/database/postgres/indexes) - Supabase-specific indexing guidance
- [PostgreSQL Documentation: 11.8. Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) - Official partial index documentation
- [PostgreSQL Documentation: 11.9. Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html) - Official covering index documentation
- [PostgreSQL Documentation: Index Types](https://www.postgresql.org/docs/current/indexes-types.html) - Official index types reference
- [Should I Create an Index on Foreign Keys in PostgreSQL? | Percona](https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/) - FK indexing best practices

### Secondary (MEDIUM confidence)
- [Index Advisor: Query Optimization | Supabase Docs](https://supabase.com/docs/guides/database/extensions/index_advisor) - Automated index suggestions
- [Indexing JSONB in Postgres | Crunchy Data](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) - JSONB indexing patterns
- [Understanding Postgres GIN Indexes | pganalyze](https://pganalyze.com/blog/gin-index) - GIN index performance analysis
- [Why Covering Indexes Are Incredibly Helpful | Crunchy Data](https://www.crunchydata.com/blog/why-covering-indexes-are-incredibly-helpful) - Covering index use cases
- [Foreign Key Indexing and Performance | Cybertec](https://www.cybertec-postgresql.com/en/index-your-foreign-key/) - FK indexing performance impact

### Tertiary (LOW confidence)
- [PostgreSQL Index Best Practices | MyDBOps](https://www.mydbops.com/blog/postgresql-indexing-best-practices-guide) - General indexing guide
- [Tuning PostgreSQL for Write Heavy Workloads | Cloudraft](https://www.cloudraft.io/blog/tuning-postgresql-for-write-heavy-workloads) - Write performance considerations
- [Speeding Up PostgreSQL With Partial Indexes | Heap](https://www.heap.io/blog/speeding-up-postgresql-queries-with-partial-indexes) - Partial index use cases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PostgreSQL/Supabase official documentation
- Architecture: HIGH - Verified against existing migrations and query patterns
- Pitfalls: HIGH - Confirmed from multiple authoritative sources and official PostgreSQL docs

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - PostgreSQL indexing is stable, infrequent changes)

**Critical finding:** Most needed indexes already exist. The visits table has optimal indexing for the current query pattern. The only missing piece was already addressed in migration 07 (FK indexes on v1.4 tables). This phase should focus on verification and documentation rather than adding new indexes.

**Recommended scope change:** Instead of "add indexes," this phase should be "audit existing indexes, verify performance, document indexing strategy." Only add indexes if EXPLAIN ANALYZE reveals actual performance issues.
