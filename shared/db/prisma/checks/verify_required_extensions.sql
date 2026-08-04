DO $$
DECLARE
  missing_extensions TEXT[];
BEGIN
  SELECT ARRAY(
    SELECT extension_name
    FROM unnest(ARRAY['pgcrypto']::TEXT[]) AS extension_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = extension_name
    )
  )
  INTO missing_extensions;

  IF array_length(missing_extensions, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Missing required PostgreSQL extension(s): %',
      array_to_string(missing_extensions, ', ');
  END IF;
END;
$$;
