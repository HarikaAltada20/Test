-- verify.sql
-- READ-ONLY. Runs against MAIN and against TEST after the copy.
-- Prints a "fingerprint" of the copied data and structure, one fact per line.
-- The script compares MAIN's lines with TEST's lines; any line that differs is reported.
--
-- Input: psql variable copy_schemas = JSON list of the schemas that were copied.

SET search_path = '';   -- so definitions print the same way on both sides

SET TimeZone = 'UTC';         -- so dates/times print identically on both sides
SET DateStyle = 'ISO, YMD';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 3;

-- exact row count of every table in your schemas + the copied auth / storage tables,
-- plus a checksum of the full contents for tables up to 200,000 rows
SELECT 'rows' || E'\t' || x.tbl || E'\t' || x.n::text ||
       CASE WHEN x.n <= 200000
            THEN ' checksum ' || (xpath('/row/h/text()', query_to_xml(format(
                   'SELECT md5(coalesce(string_agg(t::text, E''\n'' ORDER BY t::text), '''')) AS h FROM %s t', x.tbl),
                   false, true, '')))[1]::text
            ELSE ' (too big for checksum)' END
FROM (
  SELECT c.oid::regclass::text AS tbl,
         (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %s', c.oid::regclass::text),
                                              false, true, '')))[1]::text::bigint AS n
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND (n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
         OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities'))
         OR (n.nspname = 'storage' AND c.relname IN ('buckets', 'objects')))
) x
ORDER BY 1;

-- current value of every sequence in your schemas (so new rows get the same next id)
SELECT 'sequence' || E'\t' || format('%I.%I', schemaname, sequencename) || E'\t' || coalesce(last_value::text, 'unused')
FROM pg_catalog.pg_sequences
WHERE schemaname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- columns of every table / view
SELECT 'column' || E'\t' || c.oid::regclass::text || E'\t' || a.attname || ' ' ||
       pg_catalog.format_type(a.atttypid, a.atttypmod) ||
       CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
       coalesce(' DEFAULT ' || regexp_replace(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid), '\s+', ' ', 'g'), '') ||
       CASE WHEN a.attidentity <> '' THEN ' IDENTITY' ELSE '' END
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- constraints (primary keys, foreign keys, unique, check)
SELECT 'constraint' || E'\t' || c.oid::regclass::text || E'\t' || con.conname || ': ' ||
       regexp_replace(pg_catalog.pg_get_constraintdef(con.oid), '\s+', ' ', 'g')
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- indexes
SELECT 'index' || E'\t' || pg_catalog.pg_get_indexdef(i.indexrelid)
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid = i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- views and materialized views (definition fingerprint)
-- (Postgres 15 and 17 print view definitions slightly differently, so between different
--  versions only the view's columns are compared, in the 'column' section above)
SELECT 'view' || E'\t' || c.oid::regclass::text || E'\t' ||
       CASE WHEN :'same_major' = 'true' THEN md5(pg_catalog.pg_get_viewdef(c.oid))
            ELSE 'exists (definition compared via its columns)' END
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm') AND n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- functions (definition fingerprint), not counting extension-owned ones
SELECT 'function' || E'\t' || p.oid::regprocedure::text || E'\t' ||
       -- fingerprint of the function's code and settings as stored (same on every Postgres version).
       -- Windows line endings (CR) are ignored: psql on Windows drops them when it reads the import
       -- file, which changes nothing about how the function works.
       md5(p.prokind::text || '|' || l.lanname || '|' || p.prorettype::regtype::text || '|' || p.proretset::text || '|' ||
           p.provolatile::text || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|' ||
           coalesce(replace(p.prosrc, chr(13), ''), ''))
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
  AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_proc'::regclass
                    AND d.objid = p.oid AND d.deptype = 'e');

-- custom types: enums (with their values) and domains
SELECT 'type' || E'\t' || t.oid::regtype::text || E'\t' ||
       CASE t.typtype WHEN 'e' THEN (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
                                     FROM pg_catalog.pg_enum WHERE enumtypid = t.oid)
                      ELSE t.typtype::text END
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typtype IN ('e', 'd') AND n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
  AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_type'::regclass
                    AND d.objid = t.oid AND d.deptype = 'e');

-- row level security switched on/off per table
SELECT 'rls' || E'\t' || c.oid::regclass::text || E'\t' || c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p') AND n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- RLS policies: on your tables and on storage tables
SELECT 'policy' || E'\t' || c.oid::regclass::text || E'\t' || pol.polname || ' | ' ||
       pol.polcmd::text || ' | ' || pol.polpermissive::text || ' | ' ||
       (SELECT string_agg(CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(r) END, ',' ORDER BY 1)
          FROM unnest(pol.polroles) r) || ' | ' ||
       regexp_replace(coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '-'), '\s+', ' ', 'g') || ' | ' ||
       regexp_replace(coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '-'), '\s+', ' ', 'g')
FROM pg_catalog.pg_policy pol
JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json)) OR n.nspname = 'storage';

-- triggers: on your tables, and your triggers on auth / storage tables
SELECT 'trigger' || E'\t' || c.oid::regclass::text || E'\t' || pg_catalog.pg_get_triggerdef(t.oid) ||
       CASE t.tgenabled WHEN 'D' THEN ' [DISABLED]' ELSE '' END
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal
  AND (n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
       OR pn.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json)));

-- who may do what (this is what makes the Supabase API work for anon / authenticated / service_role)
SELECT 'grant' || E'\t' || x.obj || E'\t' ||
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END || ' ' ||
       a.privilege_type || CASE WHEN a.is_grantable THEN ' (grantable)' ELSE '' END
FROM (
  SELECT 'table ' || c.oid::regclass::text AS obj, c.relacl AS acl, c.relowner AS owner
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
     AND n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
  UNION ALL
  SELECT 'function ' || p.oid::regprocedure::text,
         coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner)), p.proowner
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid = 'pg_proc'::regclass
                       AND d.objid = p.oid AND d.deptype = 'e')
  UNION ALL
  SELECT 'schema ' || quote_ident(n.nspname), n.nspacl, n.nspowner
    FROM pg_catalog.pg_namespace n
   WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
) x, LATERAL pg_catalog.aclexplode(x.acl) a
WHERE x.acl IS NOT NULL AND a.grantee <> x.owner
  -- admin roles are left out: objects are owned by postgres after the copy, so their
  -- rows can legitimately differ; what matters for your app is anon/authenticated/service_role/PUBLIC
  AND a.grantee NOT IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres', 'supabase_admin'));

-- automatic grants for future objects (default privileges) in your schemas
SELECT 'defaultgrant' || E'\t' || n.nspname || E'\t' || pg_catalog.pg_get_userbyid(d.defaclrole) || ' ' ||
       d.defaclobjtype::text || ' -> ' ||
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END || ' ' || a.privilege_type
FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace,
     LATERAL pg_catalog.aclexplode(d.defaclacl) a
WHERE n.nspname IN (SELECT json_array_elements_text(:'copy_schemas'::json))
  -- Supabase's own rules (role supabase_admin) belong to each project and are never copied
  AND pg_catalog.pg_get_userbyid(d.defaclrole) <> 'supabase_admin';

-- Realtime publication membership
SELECT 'realtime' || E'\t' || format('%I.%I', schemaname, tablename)
FROM pg_catalog.pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname IN (SELECT json_array_elements_text(:'copy_schemas'::json));

-- extensions
SELECT 'extension' || E'\t' || e.extname || E'\t' || n.nspname
FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace;
