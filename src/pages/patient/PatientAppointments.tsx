import { useNavigate } from 'react-router-dom';
import { format, parseISO, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Plus, CheckCircle2, XCircle, Loader2, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData, appointmentStatusMap, type AppointmentRow } from '@/hooks/usePatientData';

export default function PatientAppointments() {
  const navigate = useNavigate();
  const { appointments, loading, refetch } = usePatientData();

  const upcoming = appointments.filter(
    (a) => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled'
  );
  const past = appointments.filter(
    (a) => isPast(parseISO(a.start_time)) || a.status === 'cancelled'
  );

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minhas Consultas</h1>
          <p className="text-sm text-muted-foreground mt-1">Suas consultas próximas e histórico.</p>
        </div>
        <Button onClick={() => navigate('/marketplace')} className="gap-2">
          <Plus className="h-4 w-4" /> Agendar consulta
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Histórico ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Nenhuma consulta futura"
              description="Encontre profissionais e marque sua próxima consulta."
              actionLabel="Agendar agora"
              onAction={() => navigate('/marketplace')}
            />
          ) : (
            upcoming.map((a) => (
              <AppointmentItem
                key={a.id}
                a={a}
                onConfirm={() => handleConfirm(a.id)}
                onCancel={() => handleCancel(a.id)}
                showActions
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-3">
          {past.length === 0 ? (
            <EmptyState icon={Stethoscope} title="Sem histórico" description="Suas consultas anteriores aparecerão aqui." />
          ) : (
            past.map((a) => <AppointmentItem key={a.id} a={a} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentItem({
  a,
  onConfirm,
  onCancel,
  showActions = false,
}: {
  a: AppointmentRow;
  onConfirm?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}) {
  const status = appointmentStatusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
  return (
    <Card>
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
            {showActions && (
              <div className="flex flex-wrap gap-2 mt-3">
                {a.status !== 'confirmed' && (
                  <Button size="sm" onClick={onConfirm} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Confirmar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
                  <XCircle className="h-4 w-4" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Calendar;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
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
