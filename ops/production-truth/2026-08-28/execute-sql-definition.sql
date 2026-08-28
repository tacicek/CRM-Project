CREATE OR REPLACE FUNCTION public.execute_sql(query text, read_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
        DECLARE
          result jsonb;
        BEGIN
          -- Note: SET TRANSACTION READ ONLY might not behave as expected within a function
          -- depending on the outer transaction state. Handle read-only logic outside if needed.

          -- Execute the dynamic query and aggregate results into a JSONB array
          EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;

          RETURN result;
        EXCEPTION
          WHEN others THEN
            -- Rethrow the error with context, including the original SQLSTATE
            RAISE EXCEPTION 'Error executing SQL (SQLSTATE: %): % ', SQLSTATE, SQLERRM;
        END;
        $function$

