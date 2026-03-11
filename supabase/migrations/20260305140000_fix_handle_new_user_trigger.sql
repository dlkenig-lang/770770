/*
  # Fix handle_new_user trigger to include username

  The original trigger did not insert `username`, causing a NOT NULL
  constraint violation after the add_username migration was applied.
  This migration re-applies the corrected trigger function.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
