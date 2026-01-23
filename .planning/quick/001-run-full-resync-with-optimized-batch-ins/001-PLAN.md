---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false

must_haves:
  truths:
    - "Full resync completes without timeout or error"
    - "All 29,250 orders are synced to toast_orders table"
    - "Line items and payments are also synced"
  artifacts: []
  key_links: []
---

<objective>
Run the Full Resync operation to sync all Toast orders using the optimized batch insert code.

Purpose: Validate that the batch insert optimization (500 rows per upsert) works correctly at scale with ~29,250 orders.
Output: Successful sync with stats showing orders processed, items inserted, payments inserted.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
The sync endpoint at `/api/toast/sync` has been optimized to use batch upserts (BATCH_SIZE = 500) instead of individual inserts. The UI at Settings > Toast has a "Full Resync" button with configurable days back.

Key implementation details:
- Batch size: 500 rows per upsert
- Endpoint: POST /api/toast/sync with { clientId, fullSync: true, daysBack: N }
- Orders, line items, and payments are all batch-upserted
- Progress logging to console: "[Sync] Upserting batch X/Y"
</context>

<tasks>

<task type="auto">
  <name>Task 1: Trigger Full Resync via API</name>
  <files>None - operational task</files>
  <action>
    1. Ensure the Next.js dev server is running (or use production URL if deployed)
    2. Determine the clientId for the Toast integration
    3. Call the sync endpoint with fullSync=true and appropriate daysBack (90-180 days to capture all historical orders)

    The API call should be:
    ```
    POST /api/toast/sync
    Content-Type: application/json

    {
      "clientId": "<client-uuid>",
      "fullSync": true,
      "daysBack": 180
    }
    ```

    Alternatively, use the UI: Navigate to Settings > Toast, select the client, set days to 180, click "Full Resync"
  </action>
  <verify>
    - API returns 200 with success: true
    - Response includes stats: { ordersProcessed, ordersInserted, itemsInserted, paymentsInserted }
    - Console logs show batch progress without errors
  </verify>
  <done>Sync completes successfully with stats showing ~29,250 orders processed</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full resync execution using optimized batch inserts</what-built>
  <how-to-verify>
    1. Check the sync response stats:
       - ordersProcessed should be ~29,250
       - ordersInserted should match (or be close if some already existed)
       - itemsInserted and paymentsInserted should be populated

    2. Verify in database:
       ```sql
       SELECT COUNT(*) FROM toast_orders;
       SELECT COUNT(*) FROM toast_order_items;
       SELECT COUNT(*) FROM toast_payments;
       ```

    3. Check toast_integrations table for last_sync_status = 'success'

    4. Note the total execution time (should be significantly faster than individual inserts)
  </how-to-verify>
  <resume-signal>Type "verified" with the stats, or describe any issues encountered</resume-signal>
</task>

</tasks>

<verification>
- Sync completes without timeout (should be under 5 minutes for ~30k orders with batch inserts)
- No errors in console logs
- Database row counts match expected order volume
- Integration status shows last_sync_status = 'success'
</verification>

<success_criteria>
- Full resync of ~29,250 orders completes successfully
- Batch insert optimization is validated at production scale
- Stats confirm orders, items, and payments all synced
</success_criteria>

<output>
After completion, create `.planning/quick/001-run-full-resync-with-optimized-batch-ins/001-SUMMARY.md` with:
- Execution time
- Final stats (orders, items, payments)
- Any observations about batch performance
</output>
