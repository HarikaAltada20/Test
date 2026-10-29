-- reset-test.sql
-- Runs ONLY against TEST, as the first part of the single import transaction.
-- If anything later in the import fails, all of this is rolled back too,
-- so TEST is never left half-empty.
--
-- What it does, in order:
--   1. Drops each of TEST's own schemas (not public) with everything in it.
--   2. Empties "public" object by object, but keeps the schema itself, so
--      Supabase's grants and default privileges on public stay intact.
--      Objects that belong to an extension are left alone.
--   3. Removes the "auto-grant" rules (default privileges) that "postgres" has
--      in public, so new tables don't get extra rights MAIN doesn't have.
--      MAIN's own rules are put back at the end of the structure step.
--   4. Removes TEST's storage access policies (MAIN's are copied back later).
--   5. Deletes TEST's storage records and auth users (+ their identities,
--      sessions, etc. via Supabase's own ON DELETE CASCADE rules).
-- It never drops or alters Supabase's own schemas (auth, storage, ...).
--
-- Input: psql variable wipe_schemas = JSON list of TEST's own schemas,
-- produced by inspect.sql on TEST and shown to you before you typed YES.

SET statement_timeout = 0;
SET lock_timeout = '60s';
SET client_min_messages = warning;   -- keep the screen quiet; what was removed is listed in import-output.txt
SELECT pg_catalog.set_config('clone.wipe_schemas', :'wipe_schemas', true),
       pg_catalog.set_config('clone.reset_log', '', true);

DO $reset$
DECLARE
  wipe   jsonb := current_setting('clone.wipe_schemas')::jsonb;
  s      text;
  stmt   text;
  stmts  text[];
  protected text[] := ARRAY['auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime',
                            '_realtime', 'pgbouncer', 'vault', 'pgsodium', 'pgsodium_masks', 'net',
                            'supabase_functions', 'supabase_migrations', 'cron', 'information_schema',
                            'pg_catalog'];
BEGIN
  PERFORM pg_catalog.set_config('search_path', '', true);  -- so every name below is fully qualified

  -- 1. drop TEST's own schemas (except public)
  FOR s IN SELECT jsonb_array_elements_text(wipe) LOOP
    IF s = ANY (protected) OR s LIKE 'pg\_%' THEN
      RAISE EXCEPTION 'Safety stop: refusing to drop Supabase schema "%"', s;
    END IF;
    IF s <> 'public' THEN
      PERFORM pg_catalog.set_config('clone.reset_log', current_setting('clone.reset_log') ||
              format(E'reset: DROP SCHEMA %I CASCADE (with everything in it)\n', s), true);
      EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', s);
    END IF;
  END LOOP;

  -- 2. empty public (views, tables, sequences, functions, types), skipping extension objects
  SELECT array_agg(x.sql ORDER BY x.ord, x.sql) INTO stmts FROM (
    SELECT CASE c.relkind WHEN 'v' THEN 1 WHEN 'm' THEN 2 WHEN 'S' THEN 4 ELSE 3 END AS ord,
           format('DROP %s IF EXISTS %s CASCADE',
             CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW'
                            WHEN 'f' THEN 'FOREIGN TABLE' WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END,
             c.oid::regclass::text) AS sql
      FROM pg_catalog.pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('v', 'm', 'r', 'p', 'f', 'S')
       AND NOT c.relispartition
       AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_class'::regclass
                         AND d.objid = c.oid AND d.deptype = 'e')
       -- sequences that belong to a table column (serial / identity) go away with their table
       AND NOT (c.relkind = 'S' AND EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
                  WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                    AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')))
    UNION ALL
    SELECT 5, format('DROP ROUTINE IF EXISTS %s CASCADE', p.oid::regprocedure::text)
      FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_proc'::regclass
                         AND d.objid = p.oid AND d.deptype = 'e')
    UNION ALL
    SELECT 6, format('DROP %s IF EXISTS %s CASCADE', CASE t.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END,
             t.oid::regtype::text)
      FROM pg_catalog.pg_type t
     WHERE t.typnamespace = 'public'::regnamespace
       AND (t.typtype IN ('e', 'd', 'r')
            OR (t.typtype = 'c' AND (SELECT relkind FROM pg_catalog.pg_class WHERE oid = t.typrelid) = 'c'))
       AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_type'::regclass
                         AND d.objid = t.oid AND d.deptype = 'e')
  ) x;
  FOREACH stmt IN ARRAY coalesce(stmts, '{}') LOOP
    PERFORM pg_catalog.set_config('clone.reset_log', current_setting('clone.reset_log') || 'reset: ' || stmt || E'\n', true);
    EXECUTE stmt;
  END LOOP;

  -- 3. remove postgres' default privileges in public (MAIN's are restored by the structure file)
  SELECT array_agg(format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON %s FROM %s',
           pg_catalog.pg_get_userbyid(d.defaclrole),
           CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS'
                                WHEN 'T' THEN 'TYPES' WHEN 'n' THEN 'SCHEMAS' END,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_catalog.pg_get_userbyid(a.grantee)) END))
    INTO stmts
    FROM pg_catalog.pg_default_acl d, LATERAL pg_catalog.aclexplode(d.defaclacl) a
   WHERE d.defaclnamespace = 'public'::regnamespace
     AND d.defaclrole = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user);
  FOREACH stmt IN ARRAY coalesce(stmts, '{}') LOOP
    EXECUTE stmt;
  END LOOP;

  -- 4. remove storage access policies (Supabase allows postgres to manage these)
  FOR stmt IN
    SELECT format('DROP POLICY IF EXISTS %I ON %s', pol.polname, pol.polrelid::regclass::text)
      FROM pg_catalog.pg_policy pol JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
     WHERE c.relnamespace = 'storage'::regnamespace
  LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'reset: not allowed to run "%" (%). The old policy stays on TEST.', stmt, SQLERRM;
    END;
  END LOOP;
END
$reset$;

-- 5a. storage records. Supabase blocks plain DELETEs on storage tables with a
--     trigger ("use the Storage API"). "replica" mode switches triggers off for
--     this session only, which is fine here: we are replacing every row anyway.
SET session_replication_role = replica;
DO $storage$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.oid::regclass::text FROM pg_catalog.pg_class c
            WHERE c.relnamespace = 'storage'::regnamespace AND c.relkind IN ('r', 'p')
              AND c.relname <> 'migrations' AND NOT c.relispartition
              -- newer Supabase storage tables (e.g. vector buckets) may be off-limits to postgres:
              -- those are skipped here and not copied either
              AND pg_catalog.has_table_privilege(c.oid, 'INSERT') AND pg_catalog.has_table_privilege(c.oid, 'DELETE')
  LOOP
    EXECUTE 'DELETE FROM ' || t;
  END LOOP;
END
$storage$;
SET session_replication_role = origin;

-- 5b. auth users. Normal mode, so Supabase's ON DELETE CASCADE rules also
--     remove their identities, sessions, refresh tokens, MFA factors, ...
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- list what was removed (goes to import-output.txt), then back to normal message level
SELECT current_setting('clone.reset_log') AS "what the reset removed on TEST";
SET client_min_messages = notice;
