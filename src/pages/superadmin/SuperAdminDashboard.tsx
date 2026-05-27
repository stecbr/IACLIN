import { useQuery } from '@tanstack/react-query';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';
import {
  Building2, Stethoscope, Users,
  AlertTriangle, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PlatformStats, PlatformClinic } from '@/types/superadmin';

// ---- Cartão de KPI ----
function StatCard({ title, value, icon: Icon, iconClass, loading }: {
  title: string; value: number | undefined;
  icon: React.ElementType; iconClass: string; loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </CardHeader>
      <CardContent>
        {loading
          ? <div className="h-9 w-16 rounded bg-muted animate-pulse" />
          : <div className="text-3xl font-bold">{value ?? 0}</div>}
      </CardContent>
    </Card>
  );
}

function SubBadge({ status }: { status: string | undefined }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Sem assinatura</Badge>;
  const map: Record<string, { label: string; className: string }> = {
    active:    { label: 'Ativo',        className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    trial:     { label: 'Trial',        className: 'bg-amber-100 text-amber-700 border-amber-300' },
    overdue:   { label: 'Inadimplente', className: 'bg-red-100 text-red-700 border-red-300' },
    cancelled: { label: 'Cancelado',    className: 'bg-gray-100 text-gray-500 border-gray-300' },
  };
  const cfg = map[status] ?? map.trial;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

export default function SuperAdminDashboard() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => fetchAdminData<PlatformStats>('stats'),
    retry: 1,
  });

  const { data: clinics = [], isLoading: loadingClinics } = useQuery({
    queryKey: ['platform-clinics'],
    queryFn: () => fetchAdminData<PlatformClinic[]>('clinics'),
    retry: 1,
  });

  const overdueItems  = clinics.filter(c => c.subscription?.status === 'overdue');
  const nearDueItems  = clinics.filter(c => {
    if (!c.subscription?.due_date) return false;
    const diff = (new Date(c.subscription.due_date).getTime() - Date.now()) / 86_400_000;
    return diff >= 0 && diff <= 7 && c.subscription.status !== 'overdue';
  });
  const recentClinics = clinics.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas dados agregados — nenhum dado de paciente ou prontuário é exibido aqui.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Clínicas cadastradas"   value={stats?.total_clinics}  icon={Building2}     iconClass="text-blue-500"    loading={loadingStats} />
        <StatCard title="Profissionais de saúde"  value={stats?.total_doctors}  icon={Stethoscope}   iconClass="text-green-500"   loading={loadingStats} />
        <StatCard title="Pacientes na plataforma" value={stats?.total_patients} icon={Users}         iconClass="text-violet-500"  loading={loadingStats} />
        <StatCard title="Assinaturas ativas"      value={stats?.active_subs}    icon={CheckCircle}   iconClass="text-emerald-500" loading={loadingStats} />
        <StatCard title="Em período trial"        value={stats?.trial_subs}     icon={Clock}         iconClass="text-amber-500"   loading={loadingStats} />
        <StatCard title="Inadimplentes"           value={stats?.overdue_subs}   icon={AlertTriangle} iconClass="text-red-500"     loading={loadingStats} />
      </div>

      {/* Alertas */}
      {(overdueItems.length > 0 || nearDueItems.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de Pagamento
          </h2>
          <div className="rounded-lg border divide-y overflow-hidden">
            {overdueItems.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20">
                <span className="font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.subscription?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Venceu {format(new Date(c.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                  <Badge variant="destructive">Inadimplente</Badge>
                </div>
              </div>
            ))}
            {nearDueItems.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/20">
                <span className="font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.subscription?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Vence {format(new Date(c.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                  <Badge variant="outline" className="border-amber-500 text-amber-600">Vence em breve</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas clínicas */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Últimas clínicas cadastradas</h2>
        {loadingClinics ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : recentClinics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma clínica cadastrada ainda.</p>
        ) : (
          <div className="rounded-lg border divide-y overflow-hidden">
            {recentClinics.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">{c.category}</span>
                  {c.city && <span className="text-xs text-muted-foreground ml-2">· {c.city}{c.state ? `/${c.state}` : ''}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.member_count} membro{c.member_count !== 1 ? 's' : ''}</span>
                  <SubBadge status={c.subscription?.status} />
                  <span>{format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota de privacidade */}
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
        <span>
          Dados de pacientes (nome, CPF, prontuários, consultas){' '}
          <strong>não são acessíveis</strong> neste painel.
        </span>
      </div>
    </div>
  );
}
