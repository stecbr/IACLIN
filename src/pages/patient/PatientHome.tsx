import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { format, parseISO, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Phone, FileText, Plus, Stethoscope,
  CreditCard, Loader2, Building2, History, Share2, XCircle, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { usePatientData, appointmentStatusMap, type AppointmentRow } from '@/hooks/usePatientData';
import { AppointmentDetailDrawer } from '@/components/patient/AppointmentDetailDrawer';
import { PatientTimelineMulti } from '@/components/patient/PatientTimelineMulti';
import { ShareMyChartDialog } from '@/components/patient/ShareMyChartDialog';
import { LinkRequestsPanel } from '@/components/patient/LinkRequestsPanel';
import { PatientPendingBudgetsBanner } from '@/components/patient/PatientPendingBudgetsBanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PatientHome() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { account, appointments, documents, patientIds, loading, refetch } = usePatientData();
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null);
  const [cancellingReqId, setCancellingReqId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('appointment_requests')
        .select('*')
        .eq('patient_user_id', user.id)
        .in('status', ['pending', 'approved'])
        .order('start_time', { ascending: true });
      setPendingRequests(data ?? []);
    };
    load();
    const channel = supabase
      .channel(`home_requests_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests', filter: `patient_user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    setCancellingReqId(id);
    const req = pendingRequests.find((r) => r.id === id);
    if (req?.status === 'approved' && req?.appointment_id) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', req.appointment_id);
    }
    const { error } = await supabase.from('appointment_requests').update({ status: 'cancelled' }).eq('id', id);
    setCancellingReqId(null);
    if (error) { toast.error('Falha ao cancelar'); return; }
    toast.success(req?.status === 'approved' ? 'Consulta cancelada' : 'Pedido cancelado');
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
    if (req?.status === 'approved') refetch();
  };

  const upcoming = appointments.filter(
    (a) => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled'
  );
  const next = upcoming[upcoming.length - 1];
  const upcomingApptIds = new Set(upcoming.map((a) => a.id));
  const reqsToShow = pendingRequests.filter((r) => {
    if (r.status === 'approved' && r.appointment_id && upcomingApptIds.has(r.appointment_id)) return false;
    return true;
  });
  const lastDoc = documents[0];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = (profile?.full_name ?? account?.full_name ?? '').split(' ')[0] || 'paciente';

  const openDrawer = (a: AppointmentRow) => {
    setSelected(a);
    setDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe suas consultas, exames e plano de saúde.</p>
      </motion.div>

      <LinkRequestsPanel />
      <PatientPendingBudgetsBanner patientIds={patientIds} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/paciente/agendar')} className="gap-2">
          <Plus className="h-4 w-4" />
          Agendar nova consulta
        </Button>
        <Button variant="outline" onClick={() => setShareOpen(true)} className="gap-2">
          <Share2 className="h-4 w-4" />
          Compartilhar meu prontuário
        </Button>
      </div>

      {next ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDrawer(next)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Próxima consulta</p>
                <Badge variant={appointmentStatusMap[next.status]?.variant ?? 'default'}>
                  {appointmentStatusMap[next.status]?.label ?? next.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={next.dentist_avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {next.dentist_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{next.dentist_name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {next.clinic_name}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="capitalize">
                    {format(parseISO(next.start_time), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(parseISO(next.start_time), 'HH:mm')}</span>
                </div>
                {(next.clinic_address || next.clinic_city) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{[next.clinic_address, next.clinic_city].filter(Boolean).join(' - ')}</span>
                  </div>
                )}
                {next.clinic_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{next.clinic_phone}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-primary font-medium pt-1">Toque para ver detalhes →</p>
              {isFuture(parseISO(next.start_time)) && next.status !== 'cancelled' && next.status !== 'completed' && (
                <div className="flex gap-2 pt-3 border-t border-primary/10" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => navigate('/paciente/agendar')}>
                    <CalendarClock className="h-3.5 w-3.5" /> Remarcar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 flex-1 text-muted-foreground" disabled={cancellingApptId === next.id} onClick={() => cancelAppointment(next.id)}>
                    <XCircle className="h-3.5 w-3.5" /> {cancellingApptId === next.id ? 'Cancelando…' : 'Cancelar'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{reqsToShow.length > 0 ? 'Aguardando confirmação da clínica' : 'Nenhuma consulta agendada'}</p>
              <p className="text-sm text-muted-foreground">
                {reqsToShow.length > 0
                  ? `Você tem ${reqsToShow.length} pedido${reqsToShow.length > 1 ? 's' : ''} em aguardo.`
                  : 'Encontre profissionais e marque sua próxima consulta.'}
              </p>
            </div>
            <Button onClick={() => navigate('/paciente/agendar')} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Agendar agora
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="overflow-hidden h-full">
            <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Plano de Saúde
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account?.insurance_provider ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold tracking-tight">{account.insurance_provider}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {account.insurance_number ?? 'Sem nº de carteirinha'}
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">Titular: {account?.full_name}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Você ainda não cadastrou um convênio.</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/paciente/plano')} className="mt-3">
                    Adicionar convênio
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Último exame
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastDoc ? (
                <div className="space-y-2">
                  <p className="font-medium">{lastDoc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(lastDoc.created_at), "dd/MM/yyyy")}
                    {lastDoc.category && ` · ${lastDoc.category}`}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/paciente/exames')} className="mt-2">
                    Ver todos
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento ainda.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Stethoscope className="h-4 w-4" /> Próximas consultas ({upcoming.length + reqsToShow.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/paciente/agendas')}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 && reqsToShow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma consulta futura.</p>
            ) : (
              <div className="space-y-2">
                {/* Pending / approved requests */}
                {reqsToShow.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border overflow-hidden ${
                      r.status === 'approved' ? 'border-emerald-500/20' : 'border-amber-500/20'
                    }`}
                  >
                    <div className={`flex items-center gap-3 p-3 ${r.status === 'approved' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.specialty ?? 'Consulta'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(parseISO(r.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {r.status === 'approved' ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 shrink-0">Agendada</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 shrink-0">Aguardando</Badge>
                      )}
                    </div>
                    <div className="flex border-t border-border/50">
                      {r.status === 'approved' && (
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors border-r border-border"
                          onClick={() => navigate('/paciente/agendar')}
                        >
                          <CalendarClock className="h-3.5 w-3.5" /> Remarcar
                        </button>
                      )}
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                        disabled={cancellingReqId === r.id}
                        onClick={() => cancelRequest(r.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" /> {cancellingReqId === r.id ? 'Cancelando…' : r.status === 'approved' ? 'Cancelar' : 'Cancelar pedido'}
                      </button>
                    </div>
                  </div>
                ))}
                {/* Confirmed appointments */}
                {upcoming.slice(0, 3).map((a) => {
                  const status = appointmentStatusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
                  const canAct = isFuture(parseISO(a.start_time)) && a.status !== 'cancelled' && a.status !== 'completed';
                  return (
                    <div key={a.id} className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => openDrawer(a)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 hover:border-primary/30 transition-all text-left"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={a.dentist_avatar ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {a.dentist_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.dentist_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(parseISO(a.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {a.clinic_name}
                          </p>
                        </div>
                        <Badge variant={status.variant} className="flex-shrink-0">{status.label}</Badge>
                      </button>
                      {canAct && (
                        <div className="flex border-t border-border">
                          <button
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors border-r border-border"
                            onClick={() => navigate('/paciente/agendar')}
                          >
                            <CalendarClock className="h-3.5 w-3.5" /> Remarcar
                          </button>
                          <button
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                            disabled={cancellingApptId === a.id}
                            onClick={() => cancelAppointment(a.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> {cancellingApptId === a.id ? 'Cancelando…' : 'Cancelar'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {patientIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <History className="h-4 w-4" /> Atividade recente
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => navigate('/paciente/agendas')}>
                  Ver tudo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PatientTimelineMulti patientIds={patientIds} limit={3} compact />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <AppointmentDetailDrawer
        appointment={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={refetch}
      />

      <ShareMyChartDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        patientName={account?.full_name ?? profile?.full_name ?? null}
      />
    </div>
  );
}
