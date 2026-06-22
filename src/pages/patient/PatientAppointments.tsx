import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Plus, Loader2, ChevronRight, History, CalendarCheck, Search, X,
  XCircle, CalendarClock,
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
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null);

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
      .in('status', ['pending', 'rejected', 'approved'])
      .order('created_at', { ascending: false });

    if (error) { console.error('[loadRequests]', error); return; }
    if (!data || data.length === 0) { setPendingRequests([]); return; }

    // Fetch clinic names + logos and dentist avatars separately
    const clinicIds = [...new Set(data.map((r: any) => r.clinic_id).filter(Boolean))];
    const dentistIds = [...new Set(data.map((r: any) => r.dentist_id).filter(Boolean))];

    const [{ data: clinics }, { data: dentists }] = await Promise.all([
      supabase.from('clinics').select('id, name, logo_url').in('id', clinicIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', dentistIds),
    ]);

    const clinicMap = new Map((clinics ?? []).map((c: any) => [c.id, c]));
    const dentistMap = new Map((dentists ?? []).map((d: any) => [d.id, d]));

    setPendingRequests(data.map((r: any) => ({
      ...r,
      clinics: clinicMap.get(r.clinic_id) ?? null,
      dentist: dentistMap.get(r.dentist_id) ?? null,
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

  const cancelAppointment = async (id: string) => {
    setCancellingApptId(id);
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    setCancellingApptId(null);
    if (error) { toast.error('Falha ao cancelar consulta'); return; }
    toast.success('Consulta cancelada');
    refetch();
  };

  const cancelRequest = async (id: string) => {
    setCancellingId(id);
    const req = pendingRequests.find((r) => r.id === id);
    if (req?.status === 'approved' && req?.appointment_id) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', req.appointment_id);
    }
    const { error } = await supabase.from('appointment_requests').update({ status: 'cancelled' }).eq('id', id);
    setCancellingId(null);
    if (error) { toast.error('Falha ao cancelar'); return; }
    toast.success(req?.status === 'approved' ? 'Consulta cancelada' : 'Pedido cancelado');
    loadRequests();
    if (req?.status === 'approved') refetch();
  };

  const upcoming = appointments.filter((a) => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled');
  const upcomingApptIds = new Set(upcoming.map((a) => a.id));
  const requestsToShow = pendingRequests.filter((r) => {
    if (r.status === 'approved' && r.appointment_id && upcomingApptIds.has(r.appointment_id)) return false;
    return true;
  });
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
              {/* Pending / approved requests */}
              {requestsToShow.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Solicitações</p>
                  {requestsToShow.map((r) => (
                    <Card
                      key={r.id}
                      className={
                        r.status === 'approved' ? 'border-emerald-500/30' :
                        r.status === 'pending'  ? 'border-amber-500/30' :
                        'border-rose-500/30'
                      }
                    >
                      <CardContent className="p-4 flex items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={r.dentist?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {r.dentist?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{r.dentist?.full_name ?? 'Profissional'}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.clinics?.name ?? 'Clínica'}</p>
                            </div>
                            {r.status === 'approved' ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 shrink-0">Agendada</Badge>
                            ) : r.status === 'pending' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 shrink-0">Aguardando</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 shrink-0">Recusado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize mt-1">
                            {format(parseISO(r.start_time), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {r.specialty && <p className="text-xs text-muted-foreground capitalize">{r.specialty}</p>}
                          {r.rejection_reason && <p className="text-xs text-rose-600 mt-1">Motivo: {r.rejection_reason}</p>}
                          {r.status === 'approved' && (
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate('/paciente/agendar')}>
                                <CalendarClock className="h-3 w-3" /> Remarcar
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-muted-foreground" disabled={cancellingId === r.id} onClick={() => cancelRequest(r.id)}>
                                <XCircle className="h-3 w-3" /> {cancellingId === r.id ? 'Cancelando…' : 'Cancelar'}
                              </Button>
                            </div>
                          )}
                          {r.status === 'pending' && (
                            <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-muted-foreground" disabled={cancellingId === r.id} onClick={() => cancelRequest(r.id)}>
                              <XCircle className="h-3 w-3 mr-1" /> {cancellingId === r.id ? 'Cancelando…' : 'Cancelar pedido'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Upcoming appointments */}
              {upcoming.length === 0 && requestsToShow.length === 0 ? (
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
                  {upcoming.map((a) => (
                    <AppointmentItem
                      key={a.id}
                      a={a}
                      onClick={() => open(a)}
                      onCancel={() => cancelAppointment(a.id)}
                      onReschedule={() => navigate('/paciente/agendar')}
                      cancelling={cancellingApptId === a.id}
                    />
                  ))}
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

function AppointmentItem({
  a, onClick, onCancel, onReschedule, cancelling,
}: {
  a: AppointmentRow;
  onClick: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  cancelling: boolean;
}) {
  const isPast = new Date(a.start_time) < new Date();
  const canAct = !isPast && a.status !== 'cancelled' && a.status !== 'completed';
  const status = appointmentStatusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
  return (
    <Card className="hover:border-primary/30 hover:shadow-sm transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 cursor-pointer" onClick={onClick}>
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
        {canAct && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={onReschedule}>
              <CalendarClock className="h-3.5 w-3.5" /> Remarcar
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs flex-1 text-muted-foreground" disabled={cancelling} onClick={onCancel}>
              <XCircle className="h-3.5 w-3.5" /> {cancelling ? 'Cancelando…' : 'Cancelar'}
            </Button>
          </div>
        )}
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
