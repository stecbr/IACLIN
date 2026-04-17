import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { format, parseISO, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Phone, FileText, Plus, Stethoscope,
  CheckCircle2, XCircle, CreditCard, Loader2, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData, appointmentStatusMap } from '@/hooks/usePatientData';

export default function PatientHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { account, appointments, documents, loading, refetch } = usePatientData();

  const upcoming = appointments.filter(
    (a) => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled'
  );
  const next = upcoming[upcoming.length - 1];
  const lastDoc = documents[0];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = (profile?.full_name ?? account?.full_name ?? '').split(' ')[0] || 'paciente';

  const handleConfirm = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Presença confirmada');
    refetch();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Consulta cancelada');
    refetch();
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
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe suas consultas, exames e plano de saúde.</p>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/marketplace')} className="gap-2">
          <Plus className="h-4 w-4" />
          Agendar nova consulta
        </Button>
      </div>

      {next ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
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
              <div className="flex flex-wrap gap-2 pt-2">
                {next.status !== 'confirmed' && (
                  <Button size="sm" onClick={() => handleConfirm(next.id)} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Confirmar presença
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleCancel(next.id)} className="gap-1.5">
                  <XCircle className="h-4 w-4" /> Cancelar
                </Button>
              </div>
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
              <p className="font-medium">Nenhuma consulta agendada</p>
              <p className="text-sm text-muted-foreground">Encontre profissionais e marque sua próxima consulta.</p>
            </div>
            <Button onClick={() => navigate('/marketplace')} size="sm" className="gap-1.5">
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
                <Stethoscope className="h-4 w-4" /> Próximas consultas ({upcoming.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/paciente/agendas')}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma consulta futura.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 3).map((a) => {
                  const status = appointmentStatusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
