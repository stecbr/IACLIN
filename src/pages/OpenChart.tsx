import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FolderHeart, Users, Star, MoreHorizontal, KeyRound } from 'lucide-react';
import { usePatientPersonalizations } from '@/hooks/usePatientPersonalization';
import { PatientPersonalizeMenu } from '@/components/patients/PatientPersonalizeMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SEARCH_STORAGE_KEY = 'open-chart.search';

export default function OpenChart() {
  const navigate = useNavigate();
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? '';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SEARCH_STORAGE_KEY, search);
  }, [search]);
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

  const ids = useMemo(() => filtered.map((p: any) => p.id), [filtered]);
  const { map: personalizations } = usePatientPersonalizations(ids);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const fa = personalizations.get(a.id)?.is_favorite ? 1 : 0;
      const fb = personalizations.get(b.id)?.is_favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });
  }, [filtered, personalizations]);

  const contextLabel = isPersonalMode
    ? 'Seus pacientes pessoais'
    : isDentist
      ? 'Pacientes que você atende nesta clínica'
      : 'Todos os pacientes da clínica';

  return (
    <div className="space-y-6">
      <PageHeader title="Abrir prontuário" description={contextLabel}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/prontuario/compartilhado')}
          className="gap-2"
        >
          <KeyRound className="h-4 w-4" />
          <span className="hidden sm:inline">Abrir prontuário compartilhado</span>
          <span className="sm:hidden">Resgatar código</span>
        </Button>
      </PageHeader>

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
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Users className="h-8 w-8" />
          <p className="text-sm">
            {search ? 'Nenhum paciente encontrado para essa busca.' : 'Nenhum paciente disponível neste contexto.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((p: any) => {
            const perso = personalizations.get(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/40 transition-colors overflow-hidden',
                )}
                style={perso?.color ? { borderLeft: `4px solid ${perso.color}` } : undefined}
              >
                <Link
                  to={`/patients/${p.id}`}
                  state={{ from: '/prontuarios' }}
                  className="flex flex-1 items-center gap-3 p-4 min-w-0"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: perso?.color ? `${perso.color}1A` : undefined,
                      color: perso?.color ?? undefined,
                    }}
                  >
                    {perso?.color ? null : (
                      <FolderHeart className="h-5 w-5 text-primary" />
                    )}
                    {perso?.color && <FolderHeart className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {perso?.is_favorite && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                      )}
                      <p className="truncate text-sm font-medium text-foreground">{p.full_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {perso?.tag && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] font-medium"
                          style={
                            perso.color
                              ? { backgroundColor: `${perso.color}1A`, color: perso.color }
                              : undefined
                          }
                        >
                          {perso.tag}
                        </Badge>
                      )}
                      {p.phone && (
                        <p className="truncate text-xs text-muted-foreground">{p.phone}</p>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="pr-2">
                  <PatientPersonalizeMenu patientId={p.id}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-60 hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </PatientPersonalizeMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}