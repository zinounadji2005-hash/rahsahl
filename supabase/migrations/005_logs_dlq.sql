-- ============================================================
-- 005_logs_dlq.sql
-- Production: Workflow Logs + Dead Letter Queue
-- ============================================================

-- =========================
-- TABLE: workflow_logs
-- =========================
-- Structured execution log for the AI sales agent workflow.
-- Each row = one stage of one execution. Used for monitoring,
-- debugging, and analytics.

CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    TEXT NOT NULL,
    shop_id         UUID,
    sender_id       TEXT,
    stage           TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning', 'info')),
    latency_ms      INTEGER,
    error_message   TEXT,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_shop_created
    ON public.workflow_logs(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_execution
    ON public.workflow_logs(execution_id);

CREATE INDEX IF NOT EXISTS idx_logs_errors
    ON public.workflow_logs(created_at DESC)
    WHERE status = 'error';

CREATE INDEX IF NOT EXISTS idx_logs_stage
    ON public.workflow_logs(stage, created_at DESC);

COMMENT ON TABLE  public.workflow_logs IS 'Structured execution logs — one row per workflow stage';
COMMENT ON COLUMN public.workflow_logs.execution_id IS 'n8n execution ID for correlation';
COMMENT ON COLUMN public.workflow_logs.stage IS 'Stage name: validation, normalize, groq, supabase, respond';
COMMENT ON COLUMN public.workflow_logs.status IS 'success, error, warning, info';
COMMENT ON COLUMN public.workflow_logs.latency_ms IS 'Time spent in this stage (milliseconds)';
COMMENT ON COLUMN public.workflow_logs.payload IS 'Stage-specific debug data (truncated)';


-- =========================
-- TABLE: failed_messages (DLQ)
-- =========================
-- Dead Letter Queue for messages that failed all retries.
-- Replayable manually or via admin tool.

CREATE TABLE IF NOT EXISTS public.failed_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID,
    sender_id       TEXT,
    channel         TEXT,
    payload         JSONB NOT NULL,
    error_message   TEXT,
    error_stage     TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'replayed', 'discarded')),
    last_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dlq_status_created
    ON public.failed_messages(status, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dlq_shop
    ON public.failed_messages(shop_id, created_at DESC);

COMMENT ON TABLE  public.failed_messages IS 'DLQ — messages that exhausted retries, awaiting manual replay';
COMMENT ON COLUMN public.failed_messages.status IS 'pending → replayed | discarded';
COMMENT ON COLUMN public.failed_messages.retry_count IS 'Number of automatic retry attempts';


-- =========================
-- RLS for new tables
-- =========================
ALTER TABLE public.workflow_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_messages  ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by n8n)
DROP POLICY IF EXISTS "service_role_all_workflow_logs" ON public.workflow_logs;
CREATE POLICY "service_role_all_workflow_logs"
    ON public.workflow_logs FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_failed_messages" ON public.failed_messages;
CREATE POLICY "service_role_all_failed_messages"
    ON public.failed_messages FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

-- Shop owners can view their own logs
DROP POLICY IF EXISTS "shop_view_own_workflow_logs" ON public.workflow_logs;
CREATE POLICY "shop_view_own_workflow_logs"
    ON public.workflow_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = shop_id);

DROP POLICY IF EXISTS "shop_view_own_failed_messages" ON public.failed_messages;
CREATE POLICY "shop_view_own_failed_messages"
    ON public.failed_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = shop_id);

-- Grant table access to service_role
GRANT ALL ON public.workflow_logs    TO service_role;
GRANT ALL ON public.failed_messages  TO service_role;
