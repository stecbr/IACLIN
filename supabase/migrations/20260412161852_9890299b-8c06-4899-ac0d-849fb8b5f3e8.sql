
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign admin if user has no roles yet (avoids overriding invite-assigned roles)
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'admin'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  RETURN NEW;
END;
$$;
