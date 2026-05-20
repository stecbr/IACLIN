DO $$
DECLARE
  v_uid uuid;
  v_clinic_ids uuid[];
  v_operator_ids uuid[];
  r record;
  sql text;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'fridavertex@gmail.com';
  IF v_uid IS NULL THEN RAISE NOTICE 'user not found'; RETURN; END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_clinic_ids FROM public.clinics WHERE owner_id = v_uid;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_operator_ids FROM public.insurance_operators WHERE owner_id = v_uid;

  -- Delete from any public table that has a clinic_id referencing one of these clinics
  IF array_length(v_clinic_ids, 1) > 0 THEN
    FOR r IN
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'clinic_id'
    LOOP
      sql := format('DELETE FROM %I.%I WHERE clinic_id = ANY($1)', r.table_schema, r.table_name);
      EXECUTE sql USING v_clinic_ids;
    END LOOP;
  END IF;

  -- Delete from any public table that has an operator_id referencing one of these operators
  IF array_length(v_operator_ids, 1) > 0 THEN
    FOR r IN
      SELECT table_schema, table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'operator_id'
    LOOP
      sql := format('DELETE FROM %I.%I WHERE operator_id = ANY($1)', r.table_schema, r.table_name);
      EXECUTE sql USING v_operator_ids;
    END LOOP;
  END IF;

  -- Delete from any public table that has user_id = uid
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'user_id'
  LOOP
    sql := format('DELETE FROM %I.%I WHERE user_id = $1', r.table_schema, r.table_name);
    EXECUTE sql USING v_uid;
  END LOOP;

  -- Common owner/dentist/professional columns
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('owner_id','dentist_id','professional_user_id','patient_user_id','invited_by','decided_by','filled_by','uploaded_by','target_user_id')
  LOOP
    sql := format('DELETE FROM %I.%I WHERE %I = $1', r.table_schema, r.table_name, r.column_name);
    EXECUTE sql USING v_uid;
  END LOOP;

  DELETE FROM public.clinics WHERE id = ANY(v_clinic_ids);
  DELETE FROM public.insurance_operators WHERE id = ANY(v_operator_ids);
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;