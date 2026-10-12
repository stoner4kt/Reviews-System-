-- CRM integration additions
-- Supports the TradePro CRM -> ReviewFlow bridge.
--   * external_id: the CRM's project/lead id, used for idempotent upserts so
--     re-notifying the same CRM record never duplicates the ReviewFlow lead.
--   * source 'crm': lets the combined dashboard distinguish CRM-sourced leads.
-- The three integration edge functions (integration-capture / -send-review /
-- -lookup) rely on this schema evolution; apply before deploying those.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Allow the CRM source value in addition to the widget/capture_fn/manual values.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('widget','capture_fn','manual','crm'));

-- Lookup/dedupe by the CRM's external id (also speeds up integration-send-review).
CREATE INDEX IF NOT EXISTS idx_leads_external_id
  ON public.leads (external_id)
  WHERE external_id IS NOT NULL;