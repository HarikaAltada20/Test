-- inspect.sql
-- READ-ONLY. Run against MAIN and against TEST before anything is changed.
-- Prints facts about one database, one per line, as tab-separated fields:
--   kind <TAB> value [<TAB> value]
-- The script reads these lines to decide what to copy and to run safety checks.
--
-- This file is the ONE place that decides which schemas are "yours":
-- every schema EXCEPT
--   * Postgres' own (pg_catalog, information_schema, pg_toast, ...)
--   * Supabase's managed schemas (listed below)
--   * schemas owned by Supabase's internal roles (supabase_admin, ...)
--   * schemas that belong to an extension
-- "public" is always yours.

SET search_path = '';

SELECT coalesce(json_agg(n.nspname ORDER BY n.nspname), '[]')::text AS user_schemas
FROM pg_catalog.pg_namespace n
WHERE n.nspname = 'public'
   OR (    n.nspname NOT LIKE 'pg\_%'
       AND n.nspname <> 'information_schema'
       AND n.nspname NOT IN ('auth', 'storage', 'extensions', 'graphql', 'graphql_public',
                             'realtime', '_realtime', 'pgbouncer', 'vault', 'pgsodium', 'pgsodium_masks',
                             'net', 'supabase_functions', 'supabase_migrations', 'cron', '_analytics',
                             'pgtle', 'pgmq', 'pgmq_public', 'topology', 'tiger', 'tiger_data', 'repack',
                             '_supavisor', 'supabase_vault', 'pg_net')
       AND pg_catalog.pg_get_userbyid(n.nspowner) NOT LIKE 'supabase\_%'
       AND pg_catalog.pg_get_userbyid(n.nspowner) NOT IN ('pgbouncer', 'pgsodium_keyholder', 'pgsodium_keyiduser', 'pgsodium_keymaker')
       AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
                       WHERE d.classid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
                         AND d.objid = n.oid AND d.deptype = 'e'))
\gset

-- general facts
SELECT 'info' || E'\t' || 'version'    || E'\t' || current_setting('server_version_num');
SELECT 'info' || E'\t' || 'user'       || E'\t' || current_user;
SELECT 'info' || E'\t' || 'bypassrls'  || E'\t' || rolbypassrls::text FROM pg_catalog.pg_roles WHERE rolname = current_user;
-- a value that is different for every database server (used to prove MAIN and TEST are not the same database)
SELECT 'info' || E'\t' || 'fingerprint' || E'\t' || pg_catalog.pg_postmaster_start_time()::text || ' / ' ||
       (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database());
SELECT 'info' || E'\t' || 'user_schemas' || E'\t' || :'user_schemas';

-- your schemas, with how many tables each has
SELECT 'schema' || E'\t' || s.name || E'\t' ||
       (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = s.name AND c.relkind IN ('r', 'p'))::text
FROM json_array_elements_text(:'user_schemas'::json) AS s(name);

-- every schema that exists (to check that schemas your code needs, like supabase_functions, exist on TEST)
SELECT 'hasschema' || E'\t' || nspname FROM pg_catalog.pg_namespace;

-- enabled extensions and the schema each lives in
SELECT 'ext' || E'\t' || e.extname || E'\t' || n.nspname || E'\t' || e.extversion
FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname <> 'plpgsql';

-- extensions that COULD be enabled on this server
SELECT 'avail' || E'\t' || name FROM pg_catalog.pg_available_extensions;

-- all roles, and the roles your objects actually grant rights to (must exist on TEST)
SELECT 'role' || E'\t' || rolname FROM pg_catalog.pg_roles WHERE rolname NOT LIKE 'pg\_%';
WITH objs AS (
  SELECT c.relacl AS acl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
  UNION ALL
  SELECT p.proacl FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
  UNION ALL
  SELECT t.typacl FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
  UNION ALL
  SELECT n.nspacl FROM pg_catalog.pg_namespace n
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
  UNION ALL
  SELECT d.defaclacl FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
), grantees AS (
  SELECT (pg_catalog.aclexplode(acl)).grantee AS r FROM objs WHERE acl IS NOT NULL
  UNION
  SELECT unnest(pol.polroles) FROM pg_catalog.pg_policy pol
    JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json)) OR n.nspname = 'storage'
)
SELECT DISTINCT 'usedrole' || E'\t' || pg_catalog.pg_get_userbyid(r) FROM grantees
WHERE r <> 0 AND pg_catalog.pg_get_userbyid(r) NOT LIKE 'pg\_%';

-- tables in the storage schema, and the columns of every auth/storage table that gets copied
SELECT 'storagetable' || E'\t' || c.relname || E'\t' ||
       -- can read it (needed on MAIN) / can add and delete rows (needed on TEST)
       has_table_privilege(c.oid, 'SELECT')::text || E'\t' ||
       (has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'DELETE'))::text
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relkind IN ('r', 'p') AND c.relname <> 'migrations';
SELECT 'col' || E'\t' || n.nspname || '.' || c.relname || E'\t' || a.attname
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
  AND ((n.nspname = 'auth' AND c.relname IN ('users', 'identities'))
       OR (n.nspname = 'storage' AND c.relkind IN ('r', 'p') AND c.relname <> 'migrations'));

-- triggers in your schemas that call Supabase "Database Webhooks" (they post to a URL)
SELECT 'webhook' || E'\t' || n.nspname || '.' || c.relname || ' -> ' || t.tgname
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND pn.nspname = 'supabase_functions'
  AND n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json));
-- your functions that call out to the internet (pg_net / http)
SELECT 'httpcall' || E'\t' || n.nspname || '.' || p.proname
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN (SELECT json_array_elements_text(:'user_schemas'::json))
  AND (p.prosrc ILIKE '%net.http_%' OR p.prosrc ILIKE '%http_request%' OR p.prosrc ILIKE '%extensions.http%');

-- is Realtime's publication there?
SELECT 'pub' || E'\t' || pubname FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime';

-- user counts, for the summary
SELECT 'count' || E'\t' || 'auth.users'       || E'\t' || count(*)::text FROM auth.users;
SELECT 'count' || E'\t' || 'auth.identities'  || E'\t' || count(*)::text FROM auth.identities;
SELECT 'count' || E'\t' || 'storage.buckets'  || E'\t' || count(*)::text FROM storage.buckets;
SELECT 'count' || E'\t' || 'storage.objects'  || E'\t' || count(*)::text FROM storage.objects;
