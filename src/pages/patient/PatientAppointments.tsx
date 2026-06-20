import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Plus, Loader2, ChevronRight, Clock, History, CalendarCheck, Search, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { usePatientData, appointmentStatusMap, type AppointmentRow } from '@/hooks/usePatientData';
import { AppointmentDetailDrawer } from '@/components/patient/AppointmentDetailDrawer';
import { PatientTimelineMulti } from '@/components/patient/PatientTimelineMulti';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'proximo' | 'historico';

const NAV: { key: Tab; label: string; icon: typeof Calendar }[] = [
  { key: 'proximo',   label: 'Próximo',   icon: CalendarCheck },
  { key: 'historico', label: 'Histórico', icon: History },
];

export default function PatientAppointments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appointments, loading, refetch } = usePatientData();
  const [tab, setTab] = useState<Tab>('proximo');
  const [historySearch, setHistorySearch] = useState('');
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // patient record IDs for the timeline
  const { data: patientIds = [] } = useQuery({
    queryKey: ['patient-ids', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('id').eq('patient_user_id', user!.id);
      return (data ?? []).map((p: any) => p.id);
    },
  });

  const loadRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .eq('patient_user_id', user.id)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) { console.error('[loadRequests]', error); return; }
    if (!data || data.length === 0) { setPendingRequests([]); return; }

    // Fetch clinic names separately to avoid FK join issues
    const clinicIds = [...new Set(data.map((r: any) => r.clinic_id).filter(Boolean))];
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name')
      .in('id', clinicIds);
    const clinicMap = new Map((clinics ?? []).map((c: any) => [c.id, c]));

    setPendingRequests(data.map((r: any) => ({
      ...r,
      clinics: clinicMap.get(r.clinic_id) ?? null,
    })));
  };

  useEffect(() => {
    loadRequests();
    if (!user) return;
    const channel = supabase
      .channel(`my_requests_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests', filter: `patient_user_id=eq.${user.id}` }, () => { loadRequests(); refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cancelRequest = async (id: string) => {
    setCancellingId(id);
    const { error } = await supabase.from('appointment_requests').update({ status: 'cancelled' }).eq('id', id);
    setCancellingId(null);
    if (error) { toast.error('Falha ao cancelar pedido'); return; }
    toast.success('Pedido cancelado');
    loadRequests();
  };

  const upcoming = appointments.filter((a) => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled');
  const open = (a: AppointmentRow) => { setSelected(a); setDrawerOpen(true); };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minhas Consultas</h1>
          <p className="text-sm text-muted-foreground mt-1">Consultas agendadas e histórico de atendimentos.</p>
        </div>
        <Button onClick={() => navigate('/paciente/agendar')} className="gap-2">
          <Plus className="h-4 w-4" /> Agendar consulta
        </Button>
      </div>

      {/* Sidebar layout */}
      <div className="flex gap-6 md:items-start">
        {/* Nav */}
        <nav className="flex md:flex-col gap-1 md:w-48 shrink-0">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors w-full text-left ${
                tab === item.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.key === 'proximo' && upcoming.length > 0 && (
                <span className={`ml-auto text-xs font-medium ${tab === item.key ? 'text-primary' : 'text-muted-foreground'}`}>
                  {upcoming.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {tab === 'proximo' && (
            <>
              {/* Pending requests */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pedidos pendentes</p>
                  {pendingRequests.map((r) => (
                    <Card key={r.id} className="border-amber-500/30">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium truncate">{r.clinics?.name ?? 'Clínica'}</p>
                            {r.status === 'pending' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">Aguardando</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30">Recusado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {format(parseISO(r.start_time), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {r.specialty && <p className="text-xs text-muted-foreground capitalize">{r.specialty}</p>}
                          {r.rejection_reason && <p className="text-xs text-rose-600 mt-1">Motivo: {r.rejection_reason}</p>}
                          {r.status === 'pending' && (
                            <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-muted-foreground" disabled={cancellingId === r.id} onClick={() => cancelRequest(r.id)}>
                              {cancellingId === r.id ? 'Cancelando…' : 'Cancelar pedido'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Upcoming appointments */}
              {upcoming.length === 0 && pendingRequests.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Nenhuma consulta agendada"
                  description="Encontre profissionais e marque sua próxima consulta."
                  actionLabel="Agendar agora"
                  onAction={() => navigate('/paciente/agendar')}
                />
              ) : upcoming.length === 0 ? null : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {upcoming.length} consulta{upcoming.length > 1 ? 's' : ''} agendada{upcoming.length > 1 ? 's' : ''}
                  </p>
                  {upcoming.map((a) => <AppointmentItem key={a.id} a={a} onClick={() => open(a)} />)}
                </div>
              )}
            </>
          )}

          {tab === 'historico' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por médico, clínica ou especialidade…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {historySearch && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setHistorySearch('')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <PatientTimelineMulti patientIds={patientIds} searchTerm={historySearch} />
            </div>
          )}
        </div>
      </div>

      <AppointmentDetailDrawer
        appointment={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={refetch}
      />
    </div>
  );
}

function AppointmentItem({ a, onClick }: { a: AppointmentRow; onClick: () => void }) {
  const status = appointmentStatusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
  return (
    <Card className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={a.dentist_avatar ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {a.dentist_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{a.dentist_name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.clinic_name}</p>
              </div>
              <Badge variant={status.variant} className="flex-shrink-0">{status.label}</Badge>
            </div>
            <p className="text-sm mt-2 capitalize">
              {format(parseISO(a.start_time), "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon, title, description, actionLabel, onAction,
}: { icon: typeof Calendar; title: string; description: string; actionLabel?: string; onAction?: () => void; }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction} className="gap-1.5">
            <Plus className="h-4 w-4" /> {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
