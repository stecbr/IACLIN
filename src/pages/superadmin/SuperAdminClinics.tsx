import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, Pencil, Search, ArrowLeft, X } from 'lucide-react';
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
import type { PlatformClinic, SubStatus } from '@/types/superadmin';
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

const CATEGORY_LABELS: Record<string, string> = {
  odonto:     'Odontologia',
  medico:     'Medicina',
  estetica:   'Estética',
  veterinario:'Veterinária',
  outro:      'Outro',
};

const CAT_COLORS: Record<string, string> = {
  odonto: '#3b82f6', medico: '#8b5cf6', estetica: '#ec4899', outro: '#64748b',
};

// ----------------------------------------------------------------
export default function SuperAdminClinics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const categoryParam = searchParams.get('categoria') ?? '';

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<SubStatus | 'all' | 'none'>('all');
  const [editTarget,   setEditTarget]   = useState<PlatformClinic | null>(null);

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ['platform-clinics'],
    queryFn: () => import('@/hooks/usePlatformAdminData').then(m => m.fetchAdminData<PlatformClinic[]>('clinics')),
    retry: 1,
  });

  const filtered = clinics.filter(c => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'none' ? !c.subscription : c.subscription?.status === (filterStatus as SubStatus));

    const matchCategory =
      !categoryParam || (c.category ?? 'outro') === categoryParam;

    return matchSearch && matchStatus && matchCategory;
  });

  const formatBrl = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const activeCatLabel = categoryParam ? (CATEGORY_LABELS[categoryParam] ?? categoryParam) : '';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        {categoryParam && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/superadmin')}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o Dashboard
          </Button>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            Clínicas
          </h1>
          {categoryParam && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ backgroundColor: CAT_COLORS[categoryParam] ?? '#64748b' }}
            >
              {activeCatLabel}
              <button
                onClick={() => setSearchParams({})}
                className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                aria-label="Remover filtro"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {clinics.length} clínica{clinics.length !== 1 ? 's' : ''}
          {categoryParam ? ` em ${activeCatLabel}` : ' cadastradas na plataforma'}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, cidade ou e-mail..."
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

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma clínica encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Cabeçalho da tabela */}
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_80px_140px_100px_48px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
            <span>Clínica</span>
            <span>Categoria</span>
            <span>Membros</span>
            <span>Plano</span>
            <span>Vencimento</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y">
            {filtered.map(clinic => (
              <div
                key={clinic.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_80px_140px_100px_48px] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                {/* Nome + localização */}
                <div>
                  <p className="font-medium text-sm">{clinic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[clinic.city, clinic.state].filter(Boolean).join(' / ')}
                    {clinic.email && <span className="ml-2">· {clinic.email}</span>}
                  </p>
                </div>

                {/* Categoria */}
                <span className="text-sm text-muted-foreground capitalize hidden md:block">
                  {CATEGORY_LABELS[clinic.category] ?? clinic.category}
                </span>

                {/* Membros */}
                <span className="text-sm text-muted-foreground hidden md:block">
                  {clinic.member_count} membro{clinic.member_count !== 1 ? 's' : ''}
                </span>

                {/* Plano */}
                <span className="text-sm hidden md:block">
                  {clinic.subscription?.plan_name ?? '—'}
                </span>

                {/* Vencimento + valor */}
                <div className="hidden md:block text-sm">
                  {clinic.subscription?.due_date ? (
                    <>
                      <span>{format(new Date(clinic.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      {clinic.subscription.amount_cents > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({formatBrl(clinic.subscription.amount_cents)})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="hidden md:block">
                  <SubBadge status={clinic.subscription?.status as SubStatus | undefined} />
                </div>

                {/* Ação: editar assinatura */}
                <div className="flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Editar assinatura"
                    onClick={() => setEditTarget(clinic)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Mobile: status + vencimento inline */}
                <div className="flex items-center gap-2 md:hidden flex-wrap">
                  <SubBadge status={clinic.subscription?.status as SubStatus | undefined} />
                  {clinic.subscription?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Vence {format(new Date(clinic.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de edição de assinatura */}
      {editTarget && (
        <SubscriptionDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entityType="clinic"
          entityId={editTarget.id}
          entityName={editTarget.name}
          current={editTarget.subscription}
          invalidateKeys={[['platform-clinics'], ['platform-stats']]}
        />
      )}
    </div>
  );
}
