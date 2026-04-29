import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CalendarPlus, Camera, FileText, Mic, Pill, Timer, Stethoscope,
  Apple, Activity, Footprints, HeartPulse, Scale, Ruler,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ProcedureTimer } from '@/components/dentist/tools/ProcedureTimer';
import { QuickReturn } from '@/components/dentist/tools/QuickReturn';
import { PrescriptionPad } from '@/components/dentist/tools/PrescriptionPad';
import { CertificateGenerator } from '@/components/dentist/tools/CertificateGenerator';
import { ClinicalCamera } from '@/components/dentist/tools/ClinicalCamera';
import { VoiceDictation } from '@/components/dentist/tools/VoiceDictation';
import { BmiCalculator } from '@/components/family-tools/BmiCalculator';
import { cn } from '@/lib/utils';
import { getFamilyConfig, type SpecialtyFamily } from '@/lib/specialtyFamily';

type ToolId =
  | 'bmi' | 'photo' | 'prescription' | 'certificate'
  | 'timer' | 'return' | 'voice';

interface Tool {
  id: ToolId;
  title: string;
  description: string;
  icon: typeof Stethoscope;
  color: string;
}

const FAMILY_ICON: Record<SpecialtyFamily, typeof Stethoscope> = {
  odonto: Stethoscope,
  aesthetic: Stethoscope,
  psi: Stethoscope,
  medical: Stethoscope,
  nutrition: Apple,
  physio: Activity,
  podology: Footprints,
  generic: HeartPulse,
};

function buildToolList(family: SpecialtyFamily): Tool[] {
  const base: Tool[] = [];

  // Family-specific top tool
  if (family === 'nutrition') {
    base.push({ id: 'bmi', title: 'IMC + Antropometria', description: 'Peso, altura, circunferências', icon: Scale, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400' });
  } else if (family === 'physio') {
    base.push({ id: 'bmi', title: 'IMC do paciente', description: 'Avaliação rápida', icon: Ruler, color: 'from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400' });
  } else if (family === 'medical') {
    base.push({ id: 'bmi', title: 'IMC + Sinais Vitais', description: 'Avaliação inicial', icon: Scale, color: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400' });
  } else if (family === 'podology') {
    base.push({ id: 'bmi', title: 'IMC do paciente', description: 'Avaliação geral', icon: Scale, color: 'from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400' });
  }

  base.push(
    { id: 'photo', title: 'Foto Clínica', description: 'Antes/depois pela câmera', icon: Camera, color: 'from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400' },
    { id: 'prescription', title: 'Receituário', description: 'Modelos prontos + PDF', icon: Pill, color: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400' },
    { id: 'certificate', title: 'Atestado', description: 'Comparecimento e afastamento', icon: FileText, color: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400' },
    { id: 'timer', title: 'Timer de Atendimento', description: 'Cronômetro com presets', icon: Timer, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
    { id: 'return', title: 'Próximo Retorno', description: 'Agendar retorno em 1 clique', icon: CalendarPlus, color: 'from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400' },
    { id: 'voice', title: 'Ditado por Voz', description: 'Fale, vira anotação', icon: Mic, color: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400' },
  );

  return base;
}

const TITLES: Record<ToolId, { title: string; description?: string }> = {
  bmi: { title: 'IMC e Antropometria', description: 'Calcule e registre rapidamente.' },
  photo: { title: 'Foto Clínica' },
  prescription: { title: 'Receituário' },
  certificate: { title: 'Atestado' },
  timer: { title: 'Timer de Atendimento' },
  return: { title: 'Próximo Retorno' },
  voice: { title: 'Ditado por Voz' },
};

export default function FamilyToolsHome() {
  const { user, currentClinicId } = useAuth();
  const [open, setOpen] = useState<ToolId | null>(null);

  const { data: specialty } = useQuery({
    queryKey: ['family-tools-specialty', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinic_members')
        .select('specialty').eq('user_id', user!.id).eq('clinic_id', currentClinicId!).maybeSingle();
      return data?.specialty ?? null;
    },
  });

  const config = getFamilyConfig(specialty);
  const TOOLS = buildToolList(config.family);
  const FamilyIcon = FAMILY_ICON[config.family];

  const renderBody = (id: ToolId) => {
    switch (id) {
      case 'bmi': return <BmiCalculator family={config.family} />;
      case 'photo': return <ClinicalCamera />;
      case 'prescription': return <PrescriptionPad />;
      case 'certificate': return <CertificateGenerator />;
      case 'timer': return <ProcedureTimer />;
      case 'return': return <QuickReturn />;
      case 'voice': return <VoiceDictation />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ferramentas Clínicas"
        description={`Voltadas para ${config.label}.`}
      >
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <FamilyIcon className="h-3 w-3" /> {config.label}
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setOpen(tool.id)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 text-left transition-all',
                'hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
              )}
            >
              <div className={cn('inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br mb-3', tool.color)}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-sm sm:text-base font-semibold leading-tight">{tool.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{tool.description}</p>
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{TITLES[open].title}</DialogTitle>
                {TITLES[open].description && (
                  <DialogDescription>{TITLES[open].description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="pt-2">{renderBody(open)}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}