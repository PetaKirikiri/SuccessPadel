CREATE TABLE IF NOT EXISTS public.login_debug_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  seq integer NOT NULL,
  location text NOT NULL,
  message text NOT NULL,
  hypothesis_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_debug_events_session_created_idx
  ON public.login_debug_events (session_id, created_at DESC);

ALTER TABLE public.login_debug_events ENABLE ROW LEVEL SECURITY;
