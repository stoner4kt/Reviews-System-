-- ReviewFlow initial schema
-- One single-tenant Supabase project per client deployment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Table: settings — the single client's configuration (exactly one row)
-- ---------------------------------------------------------------------------
CREATE TABLE public.settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name           TEXT        NOT NULL DEFAULT '',
  google_review_url       TEXT        NOT NULL DEFAULT '',
  review_from_name        TEXT        NOT NULL DEFAULT '',
  review_from_email       TEXT        NOT NULL DEFAULT '',
  review_reply_to_email   TEXT        NOT NULL DEFAULT '',
  auto_send_enabled       BOOLEAN     NOT NULL DEFAULT true,
  auto_send_delay_hours   INT         NOT NULL DEFAULT 1
                          CHECK (auto_send_delay_hours BETWEEN 1 AND 168),
  widget_api_key          TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- Email template customisation
  email_subject_template  TEXT        NOT NULL DEFAULT
    'Thank you for choosing {{business_name}} — we''d love your feedback!',
  email_intro_text        TEXT        NOT NULL DEFAULT
    'It was a pleasure working with you. If you have 60 seconds, a Google review means the world to a small business like ours.',
  email_button_text       TEXT        NOT NULL DEFAULT 'Leave a Google Review',
  email_brand_color       TEXT        NOT NULL DEFAULT '#0ea5e9',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the single row on first deploy
INSERT INTO public.settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Table: leads — every contact form submission or manually entered lead
-- ---------------------------------------------------------------------------
CREATE TABLE public.leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT        NOT NULL DEFAULT '',
  last_name       TEXT        NOT NULL DEFAULT '',
  email           TEXT        NOT NULL,
  phone           TEXT,
  service         TEXT,
  message         TEXT,
  source          TEXT        NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('widget','capture_fn','manual')),
  status          TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','in_progress','complete','review_sent','cancelled')),
  completed_at    TIMESTAMPTZ,
  review_send_after TIMESTAMPTZ,  -- computed: completed_at + delay
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status     ON public.leads (status);
CREATE INDEX idx_leads_email      ON public.leads (email);
CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);

-- ---------------------------------------------------------------------------
-- Table: review_requests — log of every review email sent
-- ---------------------------------------------------------------------------
CREATE TABLE public.review_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  recipient_email     TEXT        NOT NULL,
  recipient_name      TEXT,
  email_subject       TEXT,
  resend_message_id   TEXT,
  status              TEXT        NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent','delivered','bounced','failed')),
  triggered_by        TEXT        NOT NULL DEFAULT 'auto'
                      CHECK (triggered_by IN ('auto','manual')),
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rr_lead_id  ON public.review_requests (lead_id);
CREATE INDEX idx_rr_sent_at  ON public.review_requests (sent_at DESC);

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to settings"
  ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to leads"
  ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to review_requests"
  ON public.review_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Widget API calls go through Edge Functions using service_role key
-- No anon policies needed — widget never touches DB directly

-- ---------------------------------------------------------------------------
-- Helper: rotate the widget API key safely (used by the Settings page)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_widget_api_key()
RETURNS TABLE (widget_api_key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.settings
     SET widget_api_key = encode(gen_random_bytes(32), 'hex'),
         updated_at = NOW()
   WHERE id = (SELECT id FROM public.settings LIMIT 1);

  RETURN QUERY SELECT s.widget_api_key FROM public.settings s ORDER BY s.id ASC LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_widget_api_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_widget_api_key() TO authenticated;