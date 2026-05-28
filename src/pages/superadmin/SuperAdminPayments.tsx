import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, Search, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';
import { RecordPaymentDialog } from '@/components/superadmin/RecordPaymentDialog';
import {
  formatBRL, METHOD_LABELS, PAYMENT_STATUS_LABELS, SEGMENT_LABELS,
  type PlatformPayment, type PlatformSubscription, type PlatformClinic, type PlatformDoctor,
  type PaymentStatus, type PaymentMethod,
} from '@/types/superadmin';
import { supabase } from '@/integrations/supabase/client';

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid:     'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  pending:  'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  failed:   'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400',
};

export default function SuperAdminPayments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [pixTarget, setPixTarget] = useState<{ sub: PlatformSubscription; name: string } | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['platform-payments'],
    queryFn: () => fetchAdminData<PlatformPayment[]>('payments'),
  });

  const { data: subs = [] } = useQuery({
    queryKey: ['platform-subscriptions-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('platform_subscriptions').select('*');
      if (error) throw error;
      return (data ?? []) as PlatformSubscription[];
    },
  });

  const { data: clinics = [] } = useQuery({
    queryKey: ['platform-clinics'],
    queryFn: () => fetchAdminData<PlatformClinic[]>('clinics'),
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['platform-doctors'],
    queryFn: () => fetchAdminData<PlatformDoctor[]>('doctors'),
  });

  // Build entity name resolver
  const entityName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clinics) map.set(`clinic:${c.id}`, c.name);
    for (const d of doctors) map.set(`doctor:${d.user_id}`, d.full_name ?? 'Profissional');
    return map;
  }, [clinics, doctors]);

  const subMap = useMemo(() => {
    const m = new Map<string, PlatformSubscription>();
    for (const s of subs) m.set(s.id, s);
    return m;
  }, [subs]);

  // KPIs
  const now = new Date();
  const in7 = addDays(now, 7);
  const mrr = subs
    .filter(s => s.status === 'active' && s.billing_cycle === 'monthly')
    .reduce((acc, s) => acc + (s.final_amount_cents || s.amount_cents || 0), 0)
    + subs
      .filter(s => s.status === 'active' && s.billing_cycle === 'yearly')
      .reduce((acc, s) => acc + Math.round((s.final_amount_cents || s.amount_cents || 0) / 12), 0);

  const overdueCount = subs.filter(s => s.status === 'overdue').length;
  const upcoming = subs.filter(s => {
    const d = s.current_period_end || s.due_date;
    if (!d) return false;
    const dt = new Date(d);
    return isAfter(dt, now) && isBefore(dt, in7);
  }).length;

  const filtered = payments.filter(p => {
    const sub = subMap.get(p.subscription_id);
    const name = sub ? entityName.get(`${sub.entity_type}:${sub.entity_id}`) ?? '' : '';
    const q = search.toLowerCase();
    const matchSearch = !q || name.toLowerCase().includes(q) || (sub?.plan_name ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchMethod = methodFilter === 'all' || p.method === methodFilter;
    return matchSearch && matchStatus && matchMethod;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-violet-500" />
          Pagamentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico e status de todas as cobranças da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="MRR estimado" value={formatBRL(mrr)} tone="primary" />
        <Kpi label="Assinaturas em atraso" value={String(overdueCount)} tone={overdueCount > 0 ? 'danger' : 'muted'} />
        <Kpi label="Vencendo em 7 dias" value={String(upcoming)} tone={upcoming > 0 ? 'warning' : 'muted'} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por entidade ou plano..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][]).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={v => setMethodFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os métodos</SelectItem>
            {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.4fr_1fr_120px_120px_120px_120px_48px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
            <span>Entidade</span>
            <span>Plano</span>
            <span>Valor</span>
            <span>Método</span>
            <span>Vencimento</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y">
            {filtered.map(p => {
              const sub = subMap.get(p.subscription_id);
              const name = sub ? entityName.get(`${sub.entity_type}:${sub.entity_id}`) ?? '—' : '—';
              return (
                <div key={p.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_120px_120px_120px_120px_48px] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sub ? SEGMENT_LABELS[sub.entity_type] : '—'}
                    </p>
                  </div>
                  <span className="text-sm hidden md:block truncate">{sub?.plan_name ?? '—'}</span>
                  <span className="text-sm font-medium hidden md:block">{formatBRL(p.amount_cents)}</span>
                  <span className="text-sm text-muted-foreground hidden md:block">{METHOD_LABELS[p.method]}</span>
                  <span className="text-sm hidden md:block">
                    {p.paid_at
                      ? format(new Date(p.paid_at), 'dd/MM/yyyy', { locale: ptBR })
                      : p.due_date
                        ? format(new Date(p.due_date), 'dd/MM/yyyy', { locale: ptBR })
                        : '—'}
                  </span>
                  <Badge variant="outline" className={`${STATUS_STYLES[p.status]} w-fit`}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
                  <div className="flex justify-end">
                    {sub && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Registrar PIX"
                        onClick={() => setPixTarget({ sub, name })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pixTarget && (
        <RecordPaymentDialog
          open={!!pixTarget}
          onClose={() => setPixTarget(null)}
          subscription={pixTarget.sub}
          entityName={pixTarget.name}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'danger' | 'warning' | 'muted' }) {
  const styles = {
    primary: 'border-primary/30 bg-primary/5',
    danger:  'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900',
    warning: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900',
    muted:   'border-border bg-muted/30',
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}