/*
  # Add username field to profiles

  - Adds unique username column
  - Updates handle_new_user trigger to populate username from metadata
  - Creates get_email_by_username RPC for unauthenticated username→email lookup (login)
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Default for existing users: use email prefix
UPDATE profiles SET username = split_part(email, '@', 1) WHERE username IS NULL;

ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Update new-user trigger to capture username from signup metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow unauthenticated callers to look up email by username (needed for login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM profiles WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username TO anon;
