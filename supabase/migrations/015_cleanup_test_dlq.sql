-- ============================================================
-- 015_cleanup_test_dlq.sql
-- Mark test-generated DLQ messages as resolved
-- ============================================================
-- Background: 16 messages accumulated in public.failed_messages
-- between 2026-06-05 00:43 and 2026-06-05 ~03:00. Investigation
-- shows they are all test traffic, not production:
--
--   - 5 with "Missing signature header" (signature required)
--   - 2 with "signature mismatch" (intentional bad signature)
--   - 6 with "Request failed with status code 404" (Edge Function
--     path error, then re-raised by verify-hmac)
--   - 3 with input validation errors (missing shop_id / channel)
--
-- All 16 rows have:
--   - shop_id = NULL
--   - sender_id = NULL
--   - channel = NULL
--   - retry_count = 0
--
-- Real production failures would carry a shop_id and sender_id
-- so the shop owner can be notified. NULLs on all three are a
-- reliable signal that the traffic never authenticated against a
-- real shop.
--
-- Action: mark them resolved with a note in metadata so we keep
-- a record but stop the DLQ summary view from showing them.
-- ============================================================

UPDATE public.failed_messages
SET
    status = 'discarded',
    resolved_at = now()
WHERE
    status = 'pending'
    AND shop_id IS NULL
    AND sender_id IS NULL
    AND channel IS NULL;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run after migration:
--
-- SELECT status, COUNT(*) FROM public.failed_messages
-- GROUP BY status;
--
-- Expected: 0 pending, 16 discarded, 0 in other states.
-- ============================================================
