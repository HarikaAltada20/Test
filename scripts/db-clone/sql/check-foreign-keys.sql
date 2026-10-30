-- check-foreign-keys.sql
-- Runs on TEST at the very end of the import transaction.
-- The data was loaded with foreign-key checks paused, so this goes through
-- every foreign key in your schemas and counts rows that point to nothing
-- (for example a profile whose user is missing). That can only happen if
-- MAIN was being written to while it was exported. It warns, it doesn't stop.
--
-- Input: psql variable copy_schemas = JSON list of the copied schemas.

SELECT pg_catalog.set_config('clone.copy_schemas', :'copy_schemas', true);

DO $fk$
DECLARE
  r record;
  n bigint;
BEGIN
  FOR r IN
    SELECT con.conname, con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent,
           string_agg(format('c.%I IS NOT NULL', ca.attname), ' AND ') AS notnull,
           string_agg(format('p.%I = c.%I', pa.attname, ca.attname), ' AND ') AS joins
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_namespace n ON n.oid = (SELECT relnamespace FROM pg_catalog.pg_class WHERE oid = con.conrelid)
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) AS k(child_col, parent_col)
    JOIN pg_catalog.pg_attribute ca ON ca.attrelid = con.conrelid  AND ca.attnum = k.child_col
    JOIN pg_catalog.pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = k.parent_col
    WHERE con.contype = 'f' AND con.conparentid = 0
      AND n.nspname IN (SELECT jsonb_array_elements_text(current_setting('clone.copy_schemas')::jsonb))
    GROUP BY con.oid, con.conname, con.conrelid, con.confrelid
  LOOP
    EXECUTE format('SELECT count(*) FROM %s c WHERE %s AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s)',
                   r.child, r.notnull, r.parent, r.joins) INTO n;
    IF n > 0 THEN
      RAISE WARNING 'Foreign key % on %: % row(s) point to a missing row in %. MAIN probably changed during the export; run the copy again at a quiet time.',
                    r.conname, r.child, n, r.parent;
    END IF;
  END LOOP;
END
$fk$;
