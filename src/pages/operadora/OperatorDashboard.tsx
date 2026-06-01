import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function OperatorDashboard() {
  const { operatorId } = useAuth();
  const [daysRange, setDaysRange] = useState<number>(14);
  const [stats, setStats] = useState({ approved: 0, pending: 0, rejected: 0, clinics: 0 });
  const [prevStats, setPrevStats] = useState({ approved: 0, pending: 0, rejected: 0, clinics: 0 });
  const [totalRequests, setTotalRequests] = useState(0);
  const [upcomingSlots, setUpcomingSlots] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [topSpecialties, setTopSpecialties] = useState<any[]>([]);
  const [avgDecisionDays, setAvgDecisionDays] = useState<number | null>(null);

  useEffect(() => {
    if (!operatorId) return;
    (async () => {
      setLoading(true);
      const days = daysRange;
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - days);

      // fetch both current + previous period to compute deltas
      const { data } = await supabase
        .from('operator_credentialings')
        .select('id, status, clinic_id, clinic_member_id, requested_at, decided_at')
        .eq('operator_id', operatorId)
        .gte('requested_at', prevStart.toISOString())
        .order('requested_at', { ascending: true });

      const rows = (data ?? []) as any[];
      const curr = rows.filter((r) => (r.requested_at ?? '').slice(0, 10) >= start.toISOString().slice(0, 10));
      const prev = rows.filter((r) => (r.requested_at ?? '').slice(0, 10) < start.toISOString().slice(0, 10));
      setTotalRequests(curr.length);

      const approved = curr.filter((r) => r.status === 'approved').length;
      const pending = curr.filter((r) => r.status === 'pending').length;
      const rejected = curr.filter((r) => r.status === 'rejected').length;
      const clinics = new Set(curr.filter((r) => r.status === 'approved').map((r) => r.clinic_id)).size;
      setStats({ approved, pending, rejected, clinics });

      const prevApproved = prev.filter((r) => r.status === 'approved').length;
      const prevPending = prev.filter((r) => r.status === 'pending').length;
      const prevRejected = prev.filter((r) => r.status === 'rejected').length;
      const prevClinics = new Set(prev.filter((r) => r.status === 'approved').map((r) => r.clinic_id)).size;
      setPrevStats({ approved: prevApproved, pending: prevPending, rejected: prevRejected, clinics: prevClinics });

      // trend for current period
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = 0;
      }
      curr.forEach((r) => {
        const key = (r.requested_at ?? '').slice(0, 10);
        if (key && dayMap[key] !== undefined) dayMap[key]++;
      });
      const trendData = Object.keys(dayMap).map((k) => ({ date: k, value: dayMap[k] }));
      setTrend(trendData);

      // status breakdown
      const breakdown = [
        { name: 'Aprovados', value: approved, color: '#10B981' },
        { name: 'Pendentes', value: pending, color: '#F59E0B' },
        { name: 'Recusados', value: rejected, color: '#EF4444' },
      ];
      setStatusBreakdown(breakdown);

      // avg decision time (dias)
      const decided = curr.filter((r) => r.decided_at);
      if (decided.length > 0) {
        const totalDays = decided.reduce((acc, r) => {
          const req = new Date(r.requested_at);
          const dec = new Date(r.decided_at);
          return acc + (dec.getTime() - req.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        setAvgDecisionDays(Number((totalDays / decided.length).toFixed(1)));
      } else {
        setAvgDecisionDays(null);
      }

      // top specialties (query clinic_members for specialties present in current period)
      const memberIds = [...new Set(curr.map((r) => r.clinic_member_id).filter(Boolean))];
      if (memberIds.length > 0) {
        const { data: members } = await supabase.from('clinic_members').select('id, specialty').in('id', memberIds);
        const specMap = new Map((members ?? []).map((m: any) => [m.id, m.specialty]));
        const specCount: Record<string, number> = {};
        curr.forEach((r) => {
          const s = specMap.get(r.clinic_member_id) ?? 'Outros';
          specCount[s] = (specCount[s] || 0) + 1;
        });
        const specArray = Object.keys(specCount).map((k) => ({ name: k, value: specCount[k] }));
        specArray.sort((a, b) => b.value - a.value);
        setTopSpecialties(specArray.slice(0, 6));
      } else {
        setTopSpecialties([]);
      }

      // upcoming available slots for approved network (next 14 days)
      const { data: approvedCreds } = await supabase
        .from('operator_credentialings')
        .select('professional_user_id')
        .eq('operator_id', operatorId)
        .eq('status', 'approved');
      const userIds = [...new Set((approvedCreds ?? []).map((r: any) => r.professional_user_id))];
      if (userIds.length > 0) {
        const today = new Date();
        const in14 = new Date();
        in14.setDate(in14.getDate() + 14);
        const { count } = await supabase
          .from('professional_availability')
          .select('id', { head: true, count: 'exact' })
          .in('user_id', userIds)
          .gte('work_date', today.toISOString().slice(0, 10))
          .lte('work_date', in14.toISOString().slice(0, 10))
          .in('mode', ['plano', 'ambos']);
        setUpcomingSlots(count ?? 0);
      } else {
        setUpcomingSlots(0);
      }

      setLoading(false);
    })();
  }, [operatorId, daysRange]);

  const kpis = useMemo(() => [
    { key: 'approved', label: 'Profissionais credenciados', value: stats.approved, prev: prevStats.approved, icon: Users, color: '#10B981' },
    { key: 'pending', label: 'Pedidos pendentes', value: stats.pending, prev: prevStats.pending, icon: Clock, color: '#F59E0B' },
    { key: 'clinics', label: 'Clínicas na rede', value: stats.clinics, prev: prevStats.clinics, icon: CheckCircle2, color: '#3B82F6' },
    { key: 'rejected', label: 'Recusados', value: stats.rejected, prev: prevStats.rejected, icon: XCircle, color: '#EF4444' },
  ], [stats, prevStats]);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / Math.max(1, prev)) * 100);
  };

  const funnelData = useMemo(() => [
    { stage: 'Solicitações', value: totalRequests, fill: '#2563EB' },
    { stage: 'Aprovados', value: stats.approved, fill: '#10B981' },
    { stage: 'Recusados', value: stats.rejected, fill: '#EF4444' },
  ], [totalRequests, stats.approved, stats.rejected]);

  const approvalRate = totalRequests > 0 ? Math.round((stats.approved / totalRequests) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Resumo da sua rede credenciada</p>
        </div>
        <div className="flex items-center gap-2">
          {[14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDaysRange(d)}
              className={`px-3 py-1 rounded-md text-sm border ${daysRange === d ? 'bg-muted/40 border-transparent' : 'border-border'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.key} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-2xl font-semibold mt-1">{loading ? '—' : k.value}</div>
              </div>
              <k.icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="flex-1 h-8">
                <ResponsiveContainer width="100%" height={32}>
                  <LineChart data={trend.map((d) => ({ date: d.date.slice(5), value: d.value }))}>
                    <Line type="monotone" dataKey="value" stroke={k.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted-foreground text-right">
                <div className={`${pctChange(k.value, k.prev) >= 0 ? 'text-green-600' : 'text-destructive'}`}> {pctChange(k.value, k.prev) >= 0 ? '+' : ''}{pctChange(k.value, k.prev)}%</div>
                <div className="text-xs text-muted-foreground">vs. período anterior</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Evolução ({daysRange} dias)</h3>
            <div className="text-xs text-muted-foreground">Tempo médio decisão: {avgDecisionDays === null ? '—' : `${avgDecisionDays} dias`}</div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-2">Top especialidades</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topSpecialties} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#0EA5A4" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Distribuição por status</h3>
            <div className="text-xs text-muted-foreground">Taxa aprovação: {approvalRate}%</div>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={74} paddingAngle={2}>
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`status-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {statusBreakdown.map((item) => (
              <div key={item.name} className="rounded-md border border-border p-2 text-center">
                <div className="text-[11px] text-muted-foreground">{item.name}</div>
                <div className="text-sm font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-2">Funil de credenciamento</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {funnelData.map((item, index) => (
                    <Cell key={`funnel-${index}`} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total período: {totalRequests} solicitações.
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Prioridades operacionais</h3>
          <div className="space-y-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Pendências agora</div>
              <div className="text-xl font-semibold mt-1">{loading ? '—' : stats.pending}</div>
              <Link to="/operadora/pedidos" className="text-xs text-primary hover:underline">Ir para pedidos</Link>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Agenda disponível (14 dias)</div>
              <div className="text-xl font-semibold mt-1">{loading ? '—' : upcomingSlots}</div>
              <Link to="/operadora/agenda" className="text-xs text-primary hover:underline">Ver agenda</Link>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Profissionais ativos</div>
              <div className="text-xl font-semibold mt-1">{loading ? '—' : stats.approved}</div>
              <Link to="/operadora/rede" className="text-xs text-primary hover:underline">Abrir rede</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}