-- tdl_profiles.password carried a UNIQUE constraint (added directly in the
-- database, not by a migration), so two accounts could not share a password:
-- adding or editing a user whose password another account already had failed
-- with HTTP 409 / 23505 "tdl_profiles_password_key". A password is not an
-- identifier, and the constraint also reveals that some account uses a given
-- password. Drop it, whether it was created as a constraint or a bare index.

ALTER TABLE public.tdl_profiles
  DROP CONSTRAINT IF EXISTS tdl_profiles_password_key;

DROP INDEX IF EXISTS public.tdl_profiles_password_key;
