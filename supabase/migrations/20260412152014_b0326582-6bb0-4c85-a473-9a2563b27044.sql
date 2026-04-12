
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'dentist', 'secretary');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-assign admin role to new users
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_assign_role
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Clinics table
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view clinics" ON public.clinics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert clinics" ON public.clinics FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update clinics" ON public.clinics FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clinics" ON public.clinics FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  insurance_provider TEXT,
  insurance_number TEXT,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  clinic_id UUID REFERENCES public.clinics(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update patients" ON public.patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete patients" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Procedures catalog
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  category TEXT NOT NULL,
  description TEXT,
  default_duration INTEGER NOT NULL DEFAULT 30,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view procedures" ON public.procedures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert procedures" ON public.procedures FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update procedures" ON public.procedures FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete procedures" ON public.procedures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  dentist_id UUID NOT NULL REFERENCES auth.users(id),
  procedure_id UUID REFERENCES public.procedures(id),
  clinic_id UUID REFERENCES public.clinics(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Odontogram entries
CREATE TABLE public.odontogram_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  tooth_number INTEGER NOT NULL CHECK (tooth_number BETWEEN 11 AND 85),
  surface TEXT,
  condition TEXT NOT NULL,
  procedure_id UUID REFERENCES public.procedures(id),
  notes TEXT,
  dentist_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.odontogram_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view odontogram" ON public.odontogram_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert odontogram" ON public.odontogram_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update odontogram" ON public.odontogram_entries FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_odontogram_updated_at BEFORE UPDATE ON public.odontogram_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Treatment plans
CREATE TABLE public.treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  dentist_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view treatment plans" ON public.treatment_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert treatment plans" ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update treatment plans" ON public.treatment_plans FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_treatment_plans_updated_at BEFORE UPDATE ON public.treatment_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Treatment plan items
CREATE TABLE public.treatment_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id),
  tooth_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view plan items" ON public.treatment_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert plan items" ON public.treatment_plan_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update plan items" ON public.treatment_plan_items FOR UPDATE TO authenticated USING (true);

-- Financial transactions
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'insurance', 'bank_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_date DATE,
  patient_id UUID REFERENCES public.patients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  dentist_id UUID REFERENCES auth.users(id),
  clinic_id UUID REFERENCES public.clinics(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert transactions" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update transactions" ON public.financial_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete transactions" ON public.financial_transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT DEFAULT 'general',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete documents" ON public.documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
