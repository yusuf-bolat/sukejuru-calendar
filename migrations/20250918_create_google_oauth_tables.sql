-- Create table for storing Google OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Temporary state mapping table for CSRF/session during OAuth flow
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  state text UNIQUE,
  user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);
