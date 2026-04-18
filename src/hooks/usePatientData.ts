import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PatientAccount {
  id: string;
  cpf: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
}

export interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  dentist_id: string;
  clinic_id: string | null;
  patient_id: string;
  procedure_id: string | null;
  procedure_name?: string | null;
  dentist_name?: string;
  dentist_avatar?: string | null;
  clinic_name?: string;
  clinic_address?: string | null;
  clinic_city?: string | null;
  clinic_phone?: string | null;
}

export interface DocumentRow {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  category: string | null;
  created_at: string;
  patient_id: string;
}

export function usePatientData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['patient-data', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: account } = await supabase
        .from('patient_accounts')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      const { data: patients } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_user_id', user!.id);

      const patientIds = (patients ?? []).map((p) => p.id);

      if (patientIds.length === 0) {
        return {
          account: account as PatientAccount | null,
          appointments: [] as AppointmentRow[],
          documents: [] as DocumentRow[],
          patientIds,
        };
      }

      const [{ data: appts }, { data: docs }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, start_time, end_time, status, notes, dentist_id, clinic_id, patient_id, procedure_id, procedures(name)')
          .in('patient_id', patientIds)
          .order('start_time', { ascending: false }),
        supabase
          .from('documents')
          .select('id, name, file_url, file_type, category, created_at, patient_id')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false }),
      ]);

      let hydrated: AppointmentRow[] = [];
      if (appts && appts.length > 0) {
        const dentistIds = [...new Set(appts.map((a) => a.dentist_id))];
        const clinicIds = [...new Set(appts.map((a) => a.clinic_id).filter(Boolean) as string[])];

        const [{ data: profs }, clinicsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', dentistIds),
          clinicIds.length > 0
            ? supabase.from('clinics').select('id, name, address, city, phone').in('id', clinicIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
        const clinMap = new Map((clinicsRes.data ?? []).map((c: any) => [c.id, c]));

        hydrated = appts.map((a: any) => ({
          id: a.id,
          start_time: a.start_time,
          end_time: a.end_time,
          status: a.status,
          notes: a.notes,
          dentist_id: a.dentist_id,
          clinic_id: a.clinic_id,
          patient_id: a.patient_id,
          procedure_id: a.procedure_id,
          procedure_name: a.procedures?.name ?? null,
          dentist_name: profMap.get(a.dentist_id)?.full_name ?? 'Profissional',
          dentist_avatar: profMap.get(a.dentist_id)?.avatar_url ?? null,
          clinic_name: a.clinic_id ? (clinMap.get(a.clinic_id) as any)?.name ?? 'Clínica' : 'Clínica',
          clinic_address: a.clinic_id ? (clinMap.get(a.clinic_id) as any)?.address ?? null : null,
          clinic_city: a.clinic_id ? (clinMap.get(a.clinic_id) as any)?.city ?? null : null,
          clinic_phone: a.clinic_id ? (clinMap.get(a.clinic_id) as any)?.phone ?? null : null,
        }));
      }

      return {
        account: account as PatientAccount | null,
        appointments: hydrated,
        documents: (docs ?? []) as DocumentRow[],
        patientIds,
      };
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['patient-data', user?.id] });

  return {
    account: query.data?.account ?? null,
    appointments: query.data?.appointments ?? [],
    documents: query.data?.documents ?? [],
    patientIds: query.data?.patientIds ?? [],
    loading: query.isLoading,
    refetch,
  };
}

export const appointmentStatusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  scheduled: { label: 'Agendada', variant: 'default' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  completed: { label: 'Realizada', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  no_show: { label: 'Faltou', variant: 'destructive' },
};
