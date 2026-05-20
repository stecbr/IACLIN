import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FolderHeart, Users } from 'lucide-react';

export default function OpenChart() {
  const [search, setSearch] = useState('');
  const { currentClinicId, user, isPersonalMode } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const isDentist = effectiveRole === 'dentist';

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['open-chart-patients', currentClinicId, isPersonalMode, isDentist ? user?.id : 'all'],
    queryFn: async () => {
      if (isPersonalMode && user) {
        const { data } = await supabase
          .from('patients')
          .select('id, full_name, phone')
          .is('clinic_id', null)
          .eq('dentist_id', user.id)
          .order('full_name')
          .limit(500);
        return data ?? [];
      }
      let allowedIds: string[] | null = null;
      if (isDentist && user) {
        const [aptRes, recRes] = await Promise.all([
          supabase.from('appointments').select('patient_id').eq('dentist_id', user.id),
          supabase.from('clinical_records').select('patient_id').eq('dentist_id', user.id),
        ]);
        allowedIds = Array.from(new Set([
          ...(aptRes.data ?? []).map((a: any) => a.patient_id),
          ...(recRes.data ?? []).map((r: any) => r.patient_id),
        ]));
        if (allowedIds.length === 0) return [];
      }
      let q = supabase.from('patients').select('id, full_name, phone').order('full_name').limit(500);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      if (allowedIds) q = q.in('id', allowedIds);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((p: any) =>
      p.full_name?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term)
    );
  }, [patients, search]);

  const contextLabel = isPersonalMode
    ? 'Seus pacientes pessoais'
    : isDentist
      ? 'Pacientes que você atende nesta clínica'
      : 'Todos os pacientes da clínica';

  return (
    <div className="space-y-6">
      <PageHeader title="Abrir prontuário" description={contextLabel} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Users className="h-8 w-8" />
          <p className="text-sm">
            {search ? 'Nenhum paciente encontrado para essa busca.' : 'Nenhum paciente disponível neste contexto.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p: any) => (
            <Link
              key={p.id}
              to={`/patients/${p.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent/40 hover:border-primary/40 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderHeart className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.full_name}</p>
                {p.phone && (
                  <p className="truncate text-xs text-muted-foreground">{p.phone}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}