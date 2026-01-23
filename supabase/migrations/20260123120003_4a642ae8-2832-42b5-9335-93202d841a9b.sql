-- Create app_settings table for admin-controlled settings
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for app to function)
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('app_name', '"Univers Flow"', 'Application display name'),
  ('app_tagline', '"Your Music Universe"', 'App tagline/description'),
  ('maintenance_mode', 'false', 'Enable maintenance mode'),
  ('maintenance_message', '"We are updating the app. Please check back soon!"', 'Message shown during maintenance'),
  ('primary_color', '"#8B5CF6"', 'Primary brand color'),
  ('accent_color', '"#D946EF"', 'Accent brand color'),
  ('feature_downloads', 'true', 'Enable/disable downloads feature'),
  ('feature_comments', 'true', 'Enable/disable song comments'),
  ('feature_social_sharing', 'true', 'Enable/disable social sharing'),
  ('feature_lyrics', 'true', 'Enable/disable lyrics display'),
  ('feature_dedications', 'true', 'Enable/disable song dedications'),
  ('feature_reactions', 'true', 'Enable/disable song reactions'),
  ('ads_enabled', 'true', 'Enable/disable ads for free users'),
  ('ads_frequency', '5', 'Show ad after every N songs'),
  ('max_upload_size_mb', '50', 'Maximum file upload size in MB'),
  ('new_user_welcome_message', '"Welcome to Univers Flow! Start exploring music now."', 'Welcome message for new users');

-- Create announcements table for push notifications
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- info, warning, promo, update
  is_active boolean NOT NULL DEFAULT true,
  target_audience text NOT NULL DEFAULT 'all', -- all, premium, free
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Users can view active announcements
CREATE POLICY "Users can view active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

-- Admins can manage all announcements
CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));

-- Create content_reports table for moderation
CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL,
  content_type text NOT NULL, -- song, comment, playlist, user
  content_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending', -- pending, reviewed, resolved, dismissed
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  action_taken text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.content_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admins can view and manage all reports
CREATE POLICY "Admins can manage reports"
  ON public.content_reports FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));