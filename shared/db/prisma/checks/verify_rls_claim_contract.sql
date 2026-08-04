DO $$
BEGIN
  IF to_regprocedure('requesting_org_id()') IS NULL THEN
    RAISE EXCEPTION 'Missing helper function requesting_org_id()';
  END IF;

  IF to_regprocedure('requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'Missing helper function requesting_user_id()';
  END IF;
END;
$$;

DO $$
DECLARE
  observed TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  observed := requesting_org_id();
  IF observed IS NOT NULL THEN
    RAISE EXCEPTION 'Expected requesting_org_id() to return NULL when org_id is missing, got %', observed;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_1","role":"authenticated","app_metadata":{"org_id":"legacy_org"}}',
    true
  );
  observed := requesting_org_id();
  IF observed <> 'legacy_org' THEN
    RAISE EXCEPTION 'Expected app_metadata.org_id fallback, got %', observed;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_1","role":"authenticated","org_id":"primary_org","app_metadata":{"org_id":"legacy_org"}}',
    true
  );
  observed := requesting_org_id();
  IF observed <> 'primary_org' THEN
    RAISE EXCEPTION 'Expected org_id to take precedence over app_metadata.org_id, got %', observed;
  END IF;
END;
$$;

DO $$
DECLARE
  is_allowed BOOLEAN;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_1","role":"authenticated"}',
    true
  );
  SELECT COALESCE(('target_org' = requesting_org_id()), false) INTO is_allowed;
  IF is_allowed THEN
    RAISE EXCEPTION 'RLS predicate should fail closed when org_id is missing';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_1","role":"authenticated","org_id":"wrong_org"}',
    true
  );
  SELECT COALESCE(('target_org' = requesting_org_id()), false) INTO is_allowed;
  IF is_allowed THEN
    RAISE EXCEPTION 'RLS predicate should deny when org_id does not match';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_1","role":"authenticated","org_id":"target_org"}',
    true
  );
  SELECT COALESCE(('target_org' = requesting_org_id()), false) INTO is_allowed;
  IF NOT is_allowed THEN
    RAISE EXCEPTION 'RLS predicate should allow when org_id matches';
  END IF;
END;
$$;
