import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stethoscope, Pencil, Search, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubscriptionDialog } from '@/components/superadmin/SubscriptionDialog';
import type { PlatformDoctor, SubStatus } from '@/types/superadmin';
import { SUB_STATUS_LABELS } from '@/types/superadmin';

// ---- Badge de status ----
function SubBadge({ status }: { status: SubStatus | undefined }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">
        Sem assinatura
      </Badge>
    );
  }
  const styles: Record<SubStatus, string> = {
    active:    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
    trial:     'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
    overdue:   'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {SUB_STATUS_LABELS[status]}
    </Badge>
  );
}

// ----------------------------------------------------------------
export default function SuperAdminDoctors() {
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<SubStatus | 'all' | 'none'>('all');
  const [editTarget,   setEditTarget]   = useState<PlatformDoctor | null>(null);

  const { data: doctors = [], isLoading, error } = useQuery({
    queryKey: ['platform-doctors'],
    queryFn: () => import('@/hooks/usePlatformAdminData').then(m => m.fetchAdminData<PlatformDoctor[]>('doctors')),
    retry: 1,
  });

  const filtered = doctors.filter(d => {
    const name   = (d.full_name ?? '').toLowerCase();
    const clinic = (d.clinic_name ?? '').toLowerCase();
    const spec   = (d.specialty ?? '').toLowerCase();
    const reg    = (d.registration ?? '').toLowerCase();
    const q      = search.toLowerCase();

    const matchSearch =
      !search ||
      name.includes(q) ||
      clinic.includes(q) ||
      spec.includes(q) ||
      reg.includes(q);

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'none' ? !d.subscription : d.subscription?.status === (filterStatus as SubStatus));

    return matchSearch && matchStatus;
  });

  const formatBrl = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-green-500" />
          Médicos / Profissionais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {doctors.length} profissional{doctors.length !== 1 ? 'is' : ''} com acesso à plataforma
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, clínica, especialidade ou registro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={v => setFilterStatus(v as SubStatus | 'all' | 'none')}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="trial">Em trial</SelectItem>
            <SelectItem value="overdue">Inadimplente</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="none">Sem assinatura</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Erro de permissão */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Erro ao carregar profissionais:</strong>{' '}
          {(error as any)?.message ?? 'Sem permissão de acesso. Execute o SQL de permissões no Supabase.'}
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhum profissional encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Cabeçalho */}
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_80px_140px_100px_48px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
            <span>Profissional</span>
            <span>Clínica</span>
            <span>Especialidade</span>
            <span>Plano</span>
            <span>Vencimento</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y">
            {filtered.map(doc => (
              <div
                key={doc.user_id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_80px_140px_100px_48px] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                {/* Nome + registro */}
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm">
                        {doc.full_name ?? 'Sem nome'}
                      </p>
                      {doc.is_owner && (
                        <span title="Dono da clínica"><Crown className="h-3 w-3 text-amber-500" /></span>
                      )}
                    </div>
                    {doc.registration && (
                      <p className="text-xs text-muted-foreground">
                        CRM/CRO: {doc.registration}
                      </p>
                    )}
                  </div>
                </div>

                {/* Clínica */}
                <span className="text-sm text-muted-foreground hidden md:block truncate">
                  {doc.clinic_name ?? '—'}
                </span>

                {/* Especialidade */}
                <span className="text-sm text-muted-foreground hidden md:block truncate capitalize">
                  {doc.specialty ?? '—'}
                </span>

                {/* Plano */}
                <span className="text-sm hidden md:block">
                  {doc.subscription?.plan_name ?? '—'}
                </span>

                {/* Vencimento + valor */}
                <div className="hidden md:block text-sm">
                  {doc.subscription?.due_date ? (
                    <>
                      <span>{format(new Date(doc.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      {doc.subscription.amount_cents > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({formatBrl(doc.subscription.amount_cents)})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="hidden md:block">
                  <SubBadge status={doc.subscription?.status as SubStatus | undefined} />
                </div>

                {/* Ação: editar assinatura */}
                <div className="flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Editar assinatura"
                    onClick={() => setEditTarget(doc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Mobile: info extra */}
                <div className="flex items-center gap-2 md:hidden flex-wrap text-xs text-muted-foreground">
                  {doc.clinic_name && <span>{doc.clinic_name}</span>}
                  {doc.specialty && <span>· {doc.specialty}</span>}
                  <SubBadge status={doc.subscription?.status as SubStatus | undefined} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de edição */}
      {editTarget && (
        <SubscriptionDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entityType="doctor"
          entityId={editTarget.user_id}
          entityName={editTarget.full_name ?? 'Profissional'}
          current={editTarget.subscription}
          invalidateKeys={[['platform-doctors'], ['platform-stats']]}
        />
      )}
    </div>
  );
}
