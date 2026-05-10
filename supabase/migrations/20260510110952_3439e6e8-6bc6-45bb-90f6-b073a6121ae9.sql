CREATE TABLE public.viral_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id text NOT NULL UNIQUE,
  title text NOT NULL,
  artist text NOT NULL,
  cover_url text,
  audio_url text,
  source text NOT NULL DEFAULT 'indexed',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  pinned_by uuid,
  pinned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_viral_picks_active_position ON public.viral_picks (is_active, position);

ALTER TABLE public.viral_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active viral picks"
  ON public.viral_picks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage viral picks"
  ON public.viral_picks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));