# Features Research: Cold Calling Scripts (v1.4)

**Domain:** Cold calling script management, outcome tracking, niche analytics
**Researched:** 2026-02-15
**Context:** Subsequent milestone adding script features to existing CRM with Cold Calling client

## Executive Summary

This research examines four interconnected features for v1.4: (1) call script management (CRUD operations), (2) per-call outcome tracking (success/fail buttons tied to leads), (3) user-defined niche taxonomies (categories users create and manage), and (4) script analytics (which scripts work best, by niche and overall).

The ecosystem shows clear table stakes (basic script CRUD, disposition codes, custom fields) and differentiators (mobile-first UI, lead-bound tracking, niche-based analytics). Anti-features are equally clear: avoid dynamic scripting complexity, over-engineered custom field systems, and analytics that aren't actionable.

**Key insight:** Modern CRM call scripting has bifurcated into two camps:
1. **Enterprise dynamic scripting** - AI-powered, context-aware, real-time adaptation (overkill for small teams)
2. **Simple script libraries** - CRUD operations with basic outcome tracking (our target)

Our feature set sits firmly in camp 2, with one differentiator: niche-based analytics that show which scripts work for which business types.

## Table Stakes

Features users expect. Missing these makes the product feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Script CRUD operations** | Industry standard - every call center tool has script create/read/update/delete | Low | Title, body (markdown/rich text), created/updated timestamps |
| **Script library view** | Users need to see all scripts at a glance | Low | List or card view, search/filter by title |
| **Per-call disposition codes** | Standard practice - 86% of call centers use disposition tracking | Medium | "Success", "Voicemail", "Not Interested", "Follow Up" - aim for 10-15 codes max |
| **Link disposition to lead** | Every call outcome must tie to a specific lead for proper tracking | Medium | Prevents orphaned data, enables lead history view |
| **Mobile-friendly outcome buttons** | Reps use phones during calls - small buttons are unusable | Low | Large tap targets (44x44px minimum), clear labels, thumb-accessible |
| **Script read view during call** | Reps need to reference scripts while on the phone | Low | Clean, readable layout without edit clutter |
| **Basic analytics dashboard** | Users expect to see "how many calls succeeded" at minimum | Medium | Success rate %, total calls, calls by outcome |
| **Custom lead categorization** | 73% of CRMs offer custom fields for lead segmentation | Medium | User-defined categories (not hardcoded list) |
| **Auto-logging timestamps** | Users expect "when did this call happen" to be automatic | Low | created_at on call_outcomes table |

### Rationale

These features appear in virtually every modern CRM with calling capabilities. [Call Center Helper](https://www.callcentrehelper.com/the-ultimate-guide-to-call-disposition-codes-175401.htm) and [Talkdesk](https://www.talkdesk.com/blog/7-benefits-of-using-call-disposition-codes-in-the-call-center/) document disposition codes as standard practice. [BigContacts](https://www.bigcontacts.com/blog/best-call-center-crm/) and [EngageBay](https://www.engagebay.com/blog/call-center-crm-software/) show that script libraries and outcome tracking are baseline expectations.

The mobile-first requirement comes from real-world usage: [CloudTalk](https://www.cloudtalk.io/blog/dialers-for-cold-calling/) and [MightyCall](https://www.mightycall.com/blog/dialers-for-cold-calling/) emphasize that modern cold calling happens on mobile devices, requiring large, accessible UI elements.

## Differentiators

Features that set this product apart. Not expected, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Niche-based script analytics** | Shows which scripts work for restaurants vs retail vs medical - actionable segmentation | High | GROUP BY niche, calculate success rate per script per niche |
| **Lead-bound tracking (no standalone counters)** | Prevents vanity metrics - every outcome must reference a real lead | Low | Enforces data integrity, enables "see all calls for this lead" view |
| **User-managed niche taxonomy** | Users define their own business categories that persist until removed - no preset list | Medium | Simple CRUD on niches table, dropdown on leads, no complex hierarchy |
| **Phone-first script reader** | Optimized for one-handed reading during active call - minimal chrome, large text | Medium | Responsive design with mobile breakpoint prioritization |
| **Script version history** | See when script was edited, revert to previous version if needed | High | Audit trail for script changes, useful when script stops working |
| **Inline outcome capture** | Log call result without leaving lead detail page - reduces clicks | Medium | Modal or sidebar with script select + outcome buttons |
| **"Last used" script tracking** | Surface recently used scripts first - reduces search time | Low | Order by last_used_at DESC in script picker |
| **Niche-to-script recommendations** | "80% success rate with Script #3 for restaurants" surfaced during lead view | High | Pre-compute stats, show on script picker when lead has niche |

### Rationale

These features don't appear in most CRMs but provide competitive advantage for cold-calling workflows.

**Niche-based analytics:** Standard CRM analytics show overall metrics (20% average close rate across industries per [Flowlu](https://www.flowlu.com/blog/productivity/sales-statistics/)). But software averages 22% while biotech averages 15% ([Everstage](https://www.everstage.com/sales-performance/sales-performance-indicators)). Segmenting by user-defined niches lets reps see "this script works for medical offices" rather than generic averages.

**Lead-bound tracking:** Most tools allow standalone disposition counters (e.g., "100 successes this week"). We enforce that every outcome ties to a lead, preventing vanity metrics and enabling complete lead history.

**User-managed taxonomy:** While 73% of CRMs offer custom fields ([Breakcold](https://www.breakcold.com/blog/crm-custom-fields)), most provide predefined dropdown options. Letting users create/delete niche categories matches the "admin tool philosophy" (all fields optional, user-controlled).

**Phone-first design:** [Toky Power Dialer](https://croclub.com/tools/best-cold-calling-software/) and [MightyCall](https://www.mightycall.com/blog/dialers-for-cold-calling/) emphasize cross-device accessibility, but few optimize for one-handed mobile reading during active calls.

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Dynamic/AI-powered scripting** | Massive complexity for minimal gain in small-team context - designed for enterprise call centers | Build simple script library with manual selection |
| **Nested niche hierarchies** | Users request "Industry > Subcategory > Type" but end up with 80% empty fields and analysis paralysis | Flat taxonomy - one niche per lead, no parent/child relationships |
| **Automated disposition assignment** | AI analyzing call transcripts to auto-tag outcomes sounds great but requires transcription service, ML model, and is error-prone | Manual outcome buttons - rep taps "Success" or "No Answer" |
| **Over-engineered custom fields** | Adding 20 optional fields "just in case" creates bloated forms and decision fatigue | Start with niche only - add fields when users explicitly request them |
| **Script approval workflows** | Multi-stage "draft > review > approved" processes appropriate for regulated industries, not cold calling | Direct edit - any user can create/modify scripts immediately |
| **Complex analytics filters** | Letting users slice by "Script + Niche + Day of Week + Time of Day + Rep" creates option paralysis | Three views: Overall, By Script, By Niche - that's it |
| **Script performance scoring** | Algorithmic "A/B/C" grades based on weighted metrics confuse more than help | Show raw success rate % - transparent and actionable |
| **Mandatory outcome fields** | Requiring "call duration", "next follow-up date", "notes" on every call creates friction | Only script and outcome required - everything else optional |
| **Call recording integration** | Technical complexity (storage, transcription, compliance) rarely worth it for cold calling workflow | Provide notes field - reps type key points manually |
| **Gamification** | Leaderboards and badges appropriate for large sales teams, feel patronizing in small team context | Simple metrics dashboard - no ranks or competitions |

### Rationale

**Dynamic scripting:** [Convoso](https://www.convoso.com/advanced-features/dynamic-scripting/) and [CallTools](https://calltools.com/blog/how-dynamic-scripting-can-improve-your-agents-performance/) promote AI-powered dynamic scripts that adapt based on CRM data. This requires significant infrastructure and is designed for large call centers with complex customer databases. For cold calling new leads, a simple script library is sufficient.

**Over-customization causes failure:** [Concise Studio](https://concise-studio.com/custom-crm-development-challenges-best-practices/) and [Secret Source Marketing](https://blog.secretsourcemarketing.com/double-digit/crm-implementing) identify over-customization as a primary CRM failure mode. Starting with minimal fields (just niche) and adding based on explicit user requests prevents bloat.

**Keep disposition codes simple:** [Call Center Helper](https://www.callcentrehelper.com/the-ultimate-guide-to-call-disposition-codes-175401.htm) and [Calilio](https://www.calilio.com/blogs/call-disposition) recommend 10-15 disposition codes maximum. Too many create confusion and inconsistent tagging.

**Script rigidity harms outcomes:** [Aircall](https://aircall.io/blog/customer-happiness/call-center-scripts/) and [Vocalcom](https://www.vocalcom.com/blog/7-mistakes-to-avoid-with-call-scripts/) warn against word-for-word script adherence. We avoid approval workflows and mandatory structures that force rigidity.

**Analytics paralysis:** Too many filter dimensions lead to "analysis paralysis" per [SyncMatters](https://syncmatters.com/blog/challenges-of-crm). Three simple views (overall, by script, by niche) provide actionable insights without overwhelming users.

## Feature Dependencies

### Dependency Graph

```
Niche Taxonomy (foundation)
  └─> Lead has niche field (M:1 relationship)
      └─> Niche-based analytics (GROUP BY lead.niche)

Script Library (foundation)
  └─> Script CRUD (create, read, update, delete)
      └─> Script read view (during call)
          └─> Call outcome tracking
              └─> Inline outcome capture (modal on lead detail)
                  └─> Script analytics (overall + by script + by niche)
```

### Build Order

1. **Niche taxonomy CRUD** - Users must be able to create/manage niches before assigning them to leads
2. **Lead.niche field** - Dropdown on Add/Edit Lead forms
3. **Script library CRUD** - Create and manage scripts
4. **Script read view** - Display script content cleanly during call
5. **Call outcomes table + logging** - Record outcome tied to lead + script
6. **Inline outcome capture UI** - Modal on lead detail with script picker + outcome buttons
7. **Basic analytics** - Overall success rate, total calls
8. **By-script analytics** - Success rate per script
9. **By-niche analytics** - Success rate per niche, script performance within niche

### Existing Feature Dependencies

This milestone builds on v1.2 Lead Management:

- **Cold Calling client exists** (`client_type='leads_only'`)
- **Manual Add Lead form** - Niche dropdown adds here
- **Edit Lead inline mode** - Niche field editable here
- **Lead detail page** - Inline outcome capture modal appears here
- **Optional field philosophy** - Niche field is optional like `has_website` and `social_media_presence`

## MVP Recommendation

For MVP (v1.4), prioritize:

### Phase 1: Niche Taxonomy Foundation
1. **Niches table** - Simple CRUD (id, name, created_at)
2. **Manage Niches UI** - Settings page with list + add/delete
3. **Lead.niche_id field** - Foreign key to niches, nullable
4. **Niche dropdown on Add/Edit Lead** - Populated from niches table

**Rationale:** Foundation for all analytics. Must exist before scripts can be analyzed by niche.

### Phase 2: Script Library
1. **Scripts table** - (id, title, body, created_at, updated_at, last_used_at)
2. **Script list view** - Card or table layout, search by title
3. **Create/Edit Script UI** - Form with title + textarea (markdown support optional)
4. **Script read view** - Clean, mobile-optimized display

**Rationale:** Reps need scripts to reference during calls. Mobile-first design critical here.

### Phase 3: Outcome Tracking
1. **Call outcomes table** - (id, lead_id, script_id, outcome, notes, created_at)
2. **Outcome buttons on lead detail** - Big, phone-friendly (Success / No Answer / Voicemail / Not Interested / Follow Up)
3. **Script picker modal** - Select script + log outcome in one flow
4. **Call history on lead detail** - Show all outcomes for this lead with timestamps

**Rationale:** Lead-bound tracking enforced at database level (NOT NULL lead_id). Inline capture reduces friction.

### Phase 4: Analytics Dashboard
1. **Overall metrics** - Total calls, success rate %, calls by outcome (pie chart)
2. **By-script metrics** - Success rate per script (table)
3. **By-niche metrics** - Success rate per niche (table)
4. **Script-within-niche matrix** - Which scripts work for which niches (heatmap or table)

**Rationale:** Actionable insights without overwhelming options. Three views provide sufficient segmentation.

### Defer to Post-MVP

- **Script version history** - High complexity, low initial value. Add if users request it.
- **Niche-to-script recommendations** - Requires usage data to compute. Add after 100+ calls logged.
- **"Last used" script sorting** - Nice-to-have optimization, not critical for launch.
- **Call duration tracking** - Users haven't requested timing data yet.
- **Advanced filters** - Start simple, add dimensions only if users ask.

## Complexity Estimates

| Feature | Complexity | Reason |
|---------|------------|--------|
| Niches CRUD | Low | Simple table + basic UI |
| Lead.niche field | Low | Add column + dropdown component (already done for has_website) |
| Scripts CRUD | Low | Standard CRUD pattern |
| Script read view | Medium | Mobile optimization requires responsive design testing |
| Call outcomes table | Low | Straightforward schema with foreign keys |
| Outcome capture UI | Medium | Modal + state management + optimistic updates |
| Call history view | Low | Query + display existing data |
| Overall analytics | Medium | Aggregation queries + chart components (already done for revenue) |
| By-script analytics | Medium | GROUP BY script, calculate percentages |
| By-niche analytics | High | JOIN outcomes > leads > niches, GROUP BY niche, handle nulls |
| Script-within-niche matrix | High | Double GROUP BY, pivot table display, empty state handling |

### Total Effort Estimate

- **Phase 1 (Niche Taxonomy):** 4-6 hours
- **Phase 2 (Script Library):** 8-10 hours
- **Phase 3 (Outcome Tracking):** 10-12 hours
- **Phase 4 (Analytics Dashboard):** 12-16 hours

**Total MVP:** 34-44 hours (~1 week sprint)

## Mobile Design Considerations

**Critical for this feature set:** Reps use phones during calls. Desktop-first design will fail.

### Outcome Button Specs

```
Mobile (< 768px):
- Button height: 60px
- Button width: 100% (stacked vertically)
- Font size: 18px
- Margin: 12px between buttons
- Colors: Success (green), No Answer (gray), Voicemail (yellow), Not Interested (red), Follow Up (blue)

Tablet (768-1024px):
- Button height: 56px
- Button width: 48% (2 columns)
- Font size: 16px

Desktop (> 1024px):
- Button height: 48px
- Button width: auto (inline)
- Font size: 14px
```

### Script Reader Specs

```
Mobile:
- Font size: 16px (readable without zoom)
- Line height: 1.6 (breathing room)
- Max width: 100vw (no horizontal scroll)
- Padding: 20px (thumb clearance)
- No sidebar chrome (full-screen content)

Desktop:
- Font size: 14px
- Max width: 800px (reading comfort)
- Padding: 40px
- Optional sidebar for script list
```

## Database Schema Preview

```sql
-- User-defined business type taxonomy
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add niche to leads (nullable, user-controlled)
ALTER TABLE leads
ADD COLUMN niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;

-- Script library
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL, -- Markdown supported
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ -- For "recently used" sorting
);

-- Call outcome tracking (lead-bound, not standalone)
CREATE TABLE call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'no_answer', 'voicemail', 'not_interested', 'follow_up')),
  notes TEXT, -- Optional rep notes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_call_outcomes_lead_id ON call_outcomes(lead_id);
CREATE INDEX idx_call_outcomes_script_id ON call_outcomes(script_id);
CREATE INDEX idx_call_outcomes_outcome ON call_outcomes(outcome);
CREATE INDEX idx_call_outcomes_created_at ON call_outcomes(created_at);
CREATE INDEX idx_leads_niche_id ON leads(niche_id);
```

## Analytics Query Patterns

### Overall Success Rate

```sql
SELECT
  outcome,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM call_outcomes
GROUP BY outcome
ORDER BY count DESC;
```

### Success Rate by Script

```sql
SELECT
  s.title,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE co.outcome = 'success') AS successes,
  ROUND(COUNT(*) FILTER (WHERE co.outcome = 'success') * 100.0 / COUNT(*), 2) AS success_rate
FROM scripts s
LEFT JOIN call_outcomes co ON co.script_id = s.id
GROUP BY s.id, s.title
ORDER BY success_rate DESC;
```

### Success Rate by Niche

```sql
SELECT
  n.name AS niche,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE co.outcome = 'success') AS successes,
  ROUND(COUNT(*) FILTER (WHERE co.outcome = 'success') * 100.0 / COUNT(*), 2) AS success_rate
FROM call_outcomes co
JOIN leads l ON l.id = co.lead_id
LEFT JOIN niches n ON n.id = l.niche_id
GROUP BY n.id, n.name
ORDER BY success_rate DESC;
```

### Script Performance Within Niche (Heatmap Data)

```sql
SELECT
  n.name AS niche,
  s.title AS script,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE co.outcome = 'success') AS successes,
  ROUND(COUNT(*) FILTER (WHERE co.outcome = 'success') * 100.0 / COUNT(*), 2) AS success_rate
FROM call_outcomes co
JOIN leads l ON l.id = co.lead_id
LEFT JOIN niches n ON n.id = l.niche_id
JOIN scripts s ON s.id = co.script_id
GROUP BY n.id, n.name, s.id, s.title
ORDER BY n.name, success_rate DESC;
```

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Table stakes features | HIGH | Cross-referenced 15+ sources showing disposition codes, script libraries, custom fields as standard |
| Mobile-first design | HIGH | Multiple sources emphasize phone-based cold calling, 44px touch targets are iOS HIG standard |
| Niche-based analytics | MEDIUM | Industry segmentation is documented (22% software, 15% biotech), but user-defined taxonomy is novel |
| Anti-features | HIGH | Over-customization and dynamic scripting complexity well-documented as failure modes |
| Database schema | HIGH | Standard patterns, foreign key relationships straightforward |
| Complexity estimates | MEDIUM | Based on existing v1.1/v1.2 patterns (revenue charts, Add Lead form), but analytics may uncover edge cases |

## Open Questions

1. **Niche vs Industry vs Category?** - Terminology matters. "Niche" feels less formal than "Industry", more specific than "Category". Confirm with user.

2. **Outcome disposition list** - Started with 5 (success, no_answer, voicemail, not_interested, follow_up). Should this be user-configurable like niches, or hardcoded?

3. **Script body format** - Plain text or markdown? Rich text editor adds complexity but improves readability.

4. **Call outcomes editing** - Should reps be able to edit/delete past call outcomes, or are they immutable for audit purposes?

5. **Script sharing** - Are scripts global (all users see all scripts) or user-specific? Assume global for MVP, but confirm.

6. **Niche deletion behavior** - If user deletes a niche, what happens to leads with that niche? SET NULL (current schema) or prevent deletion if leads exist?

## Sources

**Call Script Management:**
- [20 Best Call Center Scripting Software of 2026](https://thecxlead.com/tools/best-call-center-scripting-software/)
- [How Dynamic Scripting Can Improve Your Agents' Performance](https://calltools.com/blog/how-dynamic-scripting-can-improve-your-agents-performance/)
- [Dynamic Call Center Agent Scripting Software | Convoso](https://www.convoso.com/advanced-features/dynamic-scripting/)
- [9 Best CRM for Call Center Teams 2026](https://www.bigcontacts.com/blog/best-call-center-crm/)
- [Call Center CRM Software: Best Tools, Features & Benefits](https://www.engagebay.com/blog/call-center-crm-software/)

**Outcome Tracking:**
- [CRM Lead Management Software & Tools (2026)](https://www.bigcontacts.com/blog/crm-lead-management/)
- [CRM Call Tracking Explained: Features, Use Cases & Tools](https://www.breakcold.com/blog/crm-call-tracking)
- [A Guide to Call Disposition Codes](https://www.callcentrehelper.com/the-ultimate-guide-to-call-disposition-codes-175401.htm)
- [7 benefits of using call disposition codes in the call center](https://www.talkdesk.com/blog/7-benefits-of-using-call-disposition-codes-in-the-call-center/)
- [Call Disposition: Definition, Benefits, Challenges and Best Practices](https://www.calilio.com/blogs/call-disposition)

**User-Defined Taxonomies:**
- [How a Solid CRM Taxonomy Helps You Scale Lifecycle Marketing](https://phiture.com/mobilegrowthstack/crm-taxonomy-lifecycle-marketing/)
- [CRM Custom Fields: What They Are + How to Use Them (2025)](https://www.breakcold.com/blog/crm-custom-fields)
- [CRM Custom Fields: 40+ Custom Field Ideas for Your Industry](https://www.nutshell.com/blog/crm-custom-fields)
- [The Simple Guide to CRM Taxonomy](https://knowandconnect.com/crm-taxonomy-guide/)

**Script Analytics:**
- [Call Center Analytics: What They are and How to Use Them in 2026](https://www.amplifai.com/blog/call-center-analytics)
- [Important Metrics Every Call Center Should Track in 2026](https://callcenterstudio.com/blog/important-metrics-every-call-center-should-track-in-2026/)
- [Sales Metrics: 26 Metrics Winning Teams Are Tracking In 2026](https://monday.com/blog/crm-and-sales/sales-metrics/)
- [Sales Performance Monitoring Guide for 2026](https://www.everstage.com/sales-performance/sales-performance-monitoring)
- [140+ Sales Statistics | 2026 Update](https://spotio.com/blog/sales-statistics/)

**Mobile Cold Calling:**
- [23 Best Cold Calling Software Reviewed For 2026](https://croclub.com/tools/best-cold-calling-software/)
- [Best Dialers for Cold Calling: Types & Providers [2026]](https://www.mightycall.com/blog/dialers-for-cold-calling/)
- [20 Best Cold Calling Dialers 2026: Reviews, Pricing, Ratings](https://www.cloudtalk.io/blog/dialers-for-cold-calling/)

**Anti-Patterns:**
- [Custom CRM Development: Common Challenges & Best Practices](https://concise-studio.com/custom-crm-development-challenges-best-practices/)
- [When CRMs Go Bad: Lessons Learned from Common Pitfalls](https://blog.secretsourcemarketing.com/double-digit/crm-implementing)
- [16 Mistakes to Avoid With Call Scripting](https://www.callcentrehelper.com/16-mistakes-to-avoid-with-call-scripting-74109.htm)
- [7 Mistakes to Avoid With Call Scripts](https://www.vocalcom.com/blog/7-mistakes-to-avoid-with-call-scripts/)
- [Top CRM Challenges in 2025 and How to Overcome Them](https://syncmatters.com/blog/challenges-of-crm)
