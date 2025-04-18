-- Function to increment a column value in a table
-- This is used for incrementing counters like creators_referred, advertisers_referred, etc.
CREATE OR REPLACE FUNCTION increment(table_name text, column_name text, row_id uuid)
RETURNS void AS $$
DECLARE
  sql text;
BEGIN
  sql := format('UPDATE %I SET %I = %I + 1 WHERE id = %L',
               table_name, column_name, column_name, row_id);
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 