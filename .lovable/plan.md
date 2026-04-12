

# Multi-Tenant Clinic + Team Management

## Context
Currently all data is "loose" — no `clinic_id` isolation, roles are global (`admin|dentist|secretary`), and there's no way to manage team members. We need to make the clinic the central tenant, with the creator as owner who can directly register staff.

## Database Changes (3 migrations)

### Migration 1: Clinic Members table
Create a `clinic_members` table that links users to clinics with roles:
```sql
CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'dentist',
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, user_id)
);
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
-- Members can view their own clinic's members
CREATE POLICY "Members can view own clinic members" ON public.clinic_members
  FOR SELECT TO authenticated USING (
    clinic_id IN (SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid())
  );
-- Only owners can insert/update/delete members
-- (use security definer function to avoid recursion)
```

### Migration 2: Auto-link owner on clinic creation
- Trigger: when a row is inserted into `clinics`, auto-insert a `clinic_members` row with `is_owner = true` for the `owner_id`.

### Migration 3: Add `clinic_id` context
- Ensure existing tables (patients, appointments, financial_transactions) properly reference clinic context for future RLS scoping. (Data won't break — `clinic_id` is already nullable on most tables.)

## Code Changes

### 1. AuthContext — add `currentClinicId`
- After fetching roles, also fetch the user's `clinic_members` record to get their `clinic_id` and clinic-level role.
- Expose `currentClinicId` and `clinicRole` in context.

### 2. Settings → New "Equipe" (Team) section
Add a 5th section to `SettingsPage.tsx`:
- **List members**: Table showing name, email, role, badge for owner
- **"Adicionar Membro" form**: Owner fills in email, full name, password, and role (dentist/secretary)
- On submit: call `supabase.auth.admin` — but since we can't use admin API from client, create an **Edge Function** `invite-member` that:
  1. Uses service role key to `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
  2. Creates profile record
  3. Inserts `clinic_members` row with the chosen role
  4. Inserts `user_roles` row
- **Remove member**: Owner can remove (but not themselves)

### 3. Edge Function: `invite-member`
```
POST /invite-member
Body: { email, full_name, password, role, clinic_id }
Auth: Bearer token (verified, must be owner of clinic_id)
```
- Validates caller is owner of the clinic
- Creates user via admin API
- Inserts profile, clinic_members, user_roles

### 4. UI for Team Management
- Section icon: `Users` from lucide
- Table with columns: Nome, E-mail, Papel, Ações
- Role displayed as colored Badge (Admin/Dentista/Secretária)
- "Adicionar" button opens inline form or dialog
- Only visible to clinic owner (check `is_owner` from clinic_members)

## Files to Create/Modify
| File | Action |
|---|---|
| `supabase/functions/invite-member/index.ts` | New — edge function |
| `src/contexts/AuthContext.tsx` | Modify — add currentClinicId |
| `src/pages/SettingsPage.tsx` | Modify — add Team section |
| 1 migration | clinic_members table + trigger + RLS |

## Implementation Order
1. Database migration (clinic_members + trigger + RLS)
2. Edge function for member creation
3. AuthContext updates
4. Settings Team UI

