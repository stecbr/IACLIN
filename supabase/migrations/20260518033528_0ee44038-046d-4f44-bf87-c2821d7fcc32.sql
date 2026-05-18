-- Fix infinite recursion in operator_members RLS
DROP POLICY IF EXISTS "Operator owners can manage members" ON public.operator_members;
DROP POLICY IF EXISTS "Operator members can view own membership" ON public.operator_members;

-- Helper SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION public.is_operator_owner(_user_id uuid, _operator_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operator_members
    WHERE user_id = _user_id AND operator_id = _operator_id AND is_owner = true
  )
$$;

CREATE POLICY "Members can view their own membership row"
  ON public.operator_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "Operator owners can insert members"
  ON public.operator_members FOR INSERT
  WITH CHECK (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "Operator owners can update members"
  ON public.operator_members FOR UPDATE
  USING (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "Operator owners can delete members"
  ON public.operator_members FOR DELETE
  USING (public.is_operator_owner(auth.uid(), operator_id));
