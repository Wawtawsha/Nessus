# Metrics Capture Strategy

## Current State

The Shrike websites (Press Club, Rosemont) already track these events via `useNessusTracking`:

| Event | Count | Data Fields |
|-------|-------|-------------|
| `instant_download` | 42 | `photo_id`, `filename` (newly added) |
| `promo_popup_shown` | 113 | - |
| `promo_popup_dismissed` | 93 | - |
| `crosslink_collegethursday` | 40 | - |
| `crosslink_pressclub` | 21 | - |
| `lead_form_opened` | 7 | - |
| `queue_blade_opened` | 3 | - |
| `banner_click` | 3 | - |
| `photo_queued` | 1 | `photo_id`, `filename` (newly added) |
| `photo_dequeued` | 1 | `photo_id`, `filename` (newly added) |
| `download_email_submitted` | 1 | `photo_count`, `email_domain` |

Page views are captured as visits with `event_name = NULL`.

---

## A. New Events to Add in Shrike

Done (2026-02-15):

| Event | Component | Data | Status |
|-------|-----------|------|--------|
| `like_photo` | `LikeButton.tsx` | `{ photo_id, action: 'like' \| 'unlike' }` | Done |
| `comment_submitted` | `CommentSection.tsx` | `{ photo_id, has_name: bool }` | Done |
| `photo_lightbox_opened` | `GalleryLightbox.tsx` | `{ photo_id }` | Done |
| `zip_downloaded` | `DownloadPageContent.tsx` | `{ photo_count }` | Done |
| `theme_switched` | `ThemeSwitcher.tsx` | `{ theme: 'light' \| 'dark' }` | Done |
| `gallery_load_more` | `MasonryGrid.tsx` | `{ page_number, photos_loaded }` | Done |
| `service_page_viewed` | Services pages | `{ service_slug }` | Deferred — server components need client wrapper |

Also threaded `trackEvent` to Rosemont gallery (GalleryContent) which previously didn't pass it to MasonryGrid.

---

## B. Enrich Existing Events

Already done (2026-02-15):
- Added `filename` to `instant_download` event_data (MasonryGrid + GalleryLightbox)
- Added `filename` to `photo_queued` / `photo_dequeued` event_data (GalleryLightbox)

Still to do:
- Add `photo_count` to `download_email_submitted` if not already present (check — it already has it)
- Add `page_path` context to `lead_form_submit` (which page the lead form was opened from)

---

## C. Future Analytics Features (Post-MVP)

### Near-term
- **Session journey visualization** — show the sequence of events within a session
- **Scroll depth tracking** — fire events at 25/50/75/100% scroll milestones
- **Time on page** — calculate from page view timestamps within a session
- **Device/browser breakdown** — parse `user_agent` field already captured in visits

### Medium-term
- **Geographic heatmap** — leverage existing `ip`, `country`, `city` fields in visits
- **Referrer analysis** — which external sources drive the most engaged visitors
- **Download-to-lead conversion** — track which photo downloaders become leads

### Long-term
- **A/B testing framework** — vary promo popup timing and measure conversion rates
- **Photo engagement scoring** — composite metric from views, downloads, likes, queue adds

---

## D. Photo Name Resolution

### Short-term (done)
Added `filename` field to tracking event_data in Shrike components. The CRM dashboard's ShrikeAnalytics component shows `filename` when available, falls back to truncated UUID.

### Long-term (if needed)
If full photo metadata display is ever needed (thumbnails, dimensions, etc.), options:
1. **Cross-project RPC** — Shrike Supabase project exposes a function that returns photo metadata by ID
2. **Materialized view** — periodic sync of photo metadata from Shrike's `photos` table into Nessus
3. **Store in event_data** — simplest, just keep adding fields to the tracking payload (preferred)

Option 3 is preferred since it requires zero infrastructure changes.
