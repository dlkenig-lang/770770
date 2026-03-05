/*
  # Enable Leaked Password Protection

  Enables Supabase Auth's HaveIBeenPwned.org integration to prevent
  use of compromised passwords.
*/

UPDATE auth.config
SET password_hibp_enabled = true;
