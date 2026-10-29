-- make-extras.sql
-- READ-ONLY. Runs against MAIN and PRINTS SQL (it changes nothing).
-- The printed SQL is saved as 5-extras.sql and later run on TEST.
--
-- Why it exists: pg_dump only copies objects that live INSIDE your schemas.
-- Three things you made live on Supabase's tables instead, so pg_dump skips them:
--   * triggers on auth.users / storage tables that call your functions
--     (e.g. on_auth_user_created -> public.handle_new_user)
--   * access policies on storage.objects / storage.buckets
--   * which of your tables have Realtime switched on
-- Each statement is wrapped so that if Supabase refuses it, you get a WARNING
-- (and the final comparison shows the difference) instead of losing the whole run.
--
-- Input: psql variable copy_schemas = JSON list of MAIN's schemas being copied.

SET search_path = '';   -- makes every name below come out fully qualified

-- triggers on auth / storage tables whose function is in one of your schemas
SELECT format(
$f$DO $clone$ BEGIN
  EXECUTE %L;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not create trigger %s on %s on TEST: %%', SQLERRM;
END $clone$;$f$,
  pg_catalog.pg_get_triggerdef(t.oid), replace(t.tgname, '''', ''''''), replace(c.oid::regclass::text, '''', ''''''))
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal
  AND n.nspname IN ('auth', 'storage')
  AND pn.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
ORDER BY c.oid::regclass::text, t.tgname;

-- access policies on storage tables
SELECT format(
$f$DO $clone$ BEGIN
  EXECUTE %L;
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RAISE WARNING 'Could not create storage policy "%s" on TEST: %%', SQLERRM;
END $clone$;$f$,
  format('CREATE POLICY %I ON %s AS %s FOR %s TO %s%s%s',
         pol.polname,
         pol.polrelid::regclass::text,
         CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
         CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                         WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
         (SELECT string_agg(CASE WHEN r = 0 THEN 'PUBLIC' ELSE quote_ident(pg_catalog.pg_get_userbyid(r)) END, ', ')
            FROM unnest(pol.polroles) AS r),
         CASE WHEN pol.polqual IS NOT NULL
              THEN ' USING (' || pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END,
         CASE WHEN pol.polwithcheck IS NOT NULL
              THEN ' WITH CHECK (' || pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END),
  replace(replace(pol.polname, '''', ''''''), '%', '%%'))
FROM pg_catalog.pg_policy pol
JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
WHERE c.relnamespace = 'storage'::regnamespace
ORDER BY c.relname, pol.polname;

-- Realtime: tables of yours in the supabase_realtime publication
SELECT format(
$f$DO $clone$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE WARNING 'TEST has no supabase_realtime publication; Realtime not switched on for %s';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = %L AND tablename = %L) THEN
    EXECUTE %L;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not switch on Realtime for %s on TEST: %%', SQLERRM;
END $clone$;$f$,
  replace(format('%I.%I', pt.schemaname, pt.tablename), '''', ''''''),
  pt.schemaname, pt.tablename,
  format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', pt.schemaname, pt.tablename),
  replace(format('%I.%I', pt.schemaname, pt.tablename), '''', ''''''))
FROM pg_catalog.pg_publication_tables pt
WHERE pt.pubname = 'supabase_realtime'
  AND pt.schemaname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
ORDER BY 1;
