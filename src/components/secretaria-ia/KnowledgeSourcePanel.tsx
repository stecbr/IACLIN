import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Users, ShieldCheck, Stethoscope, DoorOpen, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { BusinessHours } from '@/components/settings/ClinicHoursSection';

interface Props {
  clinicId: string;
}

const DAY_LABELS_SHORT: Record<keyof BusinessHours, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};

function summarizeHours(h: BusinessHours | null): string {
  if (!h) return 'Não configurado';
  const open = (Object.keys(DAY_LABELS_SHORT) as (keyof BusinessHours)[])
    .filter((d) => h[d]?.enabled)
    .map((d) => `${DAY_LABELS_SHORT[d]} ${h[d].open}–${h[d].close}`);
  return open.length ? open.join(' · ') : 'Nenhum dia aberto';
}

export function KnowledgeSourcePanel({ clinicId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-knowledge-source', clinicId],
    queryFn: async () => {
      const [clinic, members, plans, rooms] = await Promise.all([
        supabase.from('clinics').select('business_hours').eq('id', clinicId).maybeSingle(),
        supabase.from('clinic_members').select('user_id, role').eq('clinic_id', clinicId),
        supabase.from('insurance_plans').select('id, name').eq('clinic_id', clinicId),
        supabase.from('clinic_rooms').select('id, name').eq('clinic_id', clinicId),
      ]);
      return {
        hours: (clinic.data?.business_hours ?? null) as unknown as BusinessHours | null,
        members: members.data ?? [],
        plans: plans.data ?? [],
        rooms: rooms.data ?? [],
      };
    },
  });

  return (
    <Card className="rounded-xl border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">O que a IA já sabe sobre sua clínica</CardTitle>
        <CardDescription>
          Estes dados vêm direto das configurações oficiais — não precisam ser repetidos nas instruções abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Row icon={<Clock className="h-4 w-4" />} label="Horário de atendimento" value={summarizeHours(data?.hours ?? null)} />
            <Row icon={<Users className="h-4 w-4" />} label="Profissionais vinculados" value={`${data?.members.length ?? 0}`} />
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Convênios aceitos" value={`${data?.plans.length ?? 0}`} />
            <Row icon={<DoorOpen className="h-4 w-4" />} label="Salas / consultórios" value={`${data?.rooms.length ?? 0}`} />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/settings"><ExternalLink className="h-3.5 w-3.5" /> Editar em Configurações</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/availability"><ExternalLink className="h-3.5 w-3.5" /> Disponibilidade</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}