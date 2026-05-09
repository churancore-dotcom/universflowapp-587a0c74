-- Lowercase-unique partial index on username (skips NULLs so signup-less rows are fine)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Lock any existing usernames so they cannot be changed via the legacy edit-username UI
UPDATE public.profiles
SET username_changed = true
WHERE username IS NOT NULL AND username_changed = false;