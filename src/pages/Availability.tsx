import { CalendarOff, CalendarRange, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeeklyTemplateTab } from '@/components/availability/WeeklyTemplateTab';
import { DurationSettingsTab } from '@/components/availability/DurationSettingsTab';

export default function Availability() {
  const isClinicSignup = useIsClinicSignup();
  const { user, currentClinicId, isPersonalMode } = useAuth();

  if (isClinicSignup) return <Navigate to="/" replace />;
  const hasScope = !!currentClinicId || isPersonalMode;

  if (!user || !hasScope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Disponibilidade" description="Defina seus dias e horários de atendimento." />
        <Card className="p-10 text-center border-dashed">
          <CalendarOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecione uma clínica ou ative o modo pessoal para configurar sua disponibilidade.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidade"
        description="Configure seu padrão semanal, duração de consulta e intervalos."
      />

      <Tabs defaultValue="weekly" className="space-y-5">
        <TabsList>
          <TabsTrigger value="weekly" className="gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Padrão semanal
          </TabsTrigger>
          <TabsTrigger value="duration" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Duração & ritmo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <WeeklyTemplateTab
            userId={user.id}
            clinicId={currentClinicId}
            scopeIsPersonal={isPersonalMode}
          />
        </TabsContent>

        <TabsContent value="duration">
          <DurationSettingsTab userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
