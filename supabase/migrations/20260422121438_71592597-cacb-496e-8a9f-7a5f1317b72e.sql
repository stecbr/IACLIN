CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_type TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';

  -- If joining an existing clinic via invite/code, assign 'dentist' role only
  IF v_user_type = 'profissional_member' THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.id, 'dentist'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
    );
    RETURN NEW;
  END IF;

  -- Default behavior: assign admin if no roles yet
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'admin'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  RETURN NEW;
END;
$function$;