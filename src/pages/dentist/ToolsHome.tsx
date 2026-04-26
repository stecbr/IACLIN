import { useState } from 'react';
import {
  CalendarPlus,
  Camera,
  Clipboard,
  FileText,
  Mic,
  Pill,
  Stethoscope,
  Syringe,
  Timer,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnestheticCalculator } from '@/components/dentist/tools/AnestheticCalculator';
import { ProcedureTimer } from '@/components/dentist/tools/ProcedureTimer';
import { QuickReturn } from '@/components/dentist/tools/QuickReturn';
import { PrescriptionPad } from '@/components/dentist/tools/PrescriptionPad';
import { CertificateGenerator } from '@/components/dentist/tools/CertificateGenerator';
import { ClinicalCamera } from '@/components/dentist/tools/ClinicalCamera';
import { VoiceDictation } from '@/components/dentist/tools/VoiceDictation';
import { ToothAtlas } from '@/components/dentist/tools/ToothAtlas';
import { QuickReference } from '@/components/dentist/tools/QuickReference';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type ToolId =
  | 'anesthetic'
  | 'timer'
  | 'return'
  | 'prescription'
  | 'certificate'
  | 'photo'
  | 'voice'
  | 'atlas'
  | 'reference';

interface Tool {
  id: ToolId;
  title: string;
  description: string;
  icon: typeof Syringe;
  color: string; // tailwind classes for accent
  available: boolean;
}

const TOOLS: Tool[] = [
  {
    id: 'anesthetic',
    title: 'Calculadora de Anestésico',
    description: 'Dose máxima por peso e fármaco',
    icon: Syringe,
    color: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400',
    available: true,
  },
  {
    id: 'timer',
    title: 'Timer de Procedimento',
    description: 'Cronômetro com presets clínicos',
    icon: Timer,
    color: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
    available: true,
  },
  {
    id: 'return',
    title: 'Próximo Retorno',
    description: 'Agendar retorno em 1 clique',
    icon: CalendarPlus,
    color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    available: true,
  },
  {
    id: 'prescription',
    title: 'Receituário',
    description: 'Modelos prontos + PDF',
    icon: Pill,
    color: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400',
    available: true,
  },
  {
    id: 'certificate',
    title: 'Atestado',
    description: 'Comparecimento e afastamento',
    icon: FileText,
    color: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400',
    available: true,
  },
  {
    id: 'photo',
    title: 'Foto Clínica',
    description: 'Antes/depois pela câmera',
    icon: Camera,
    color: 'from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400',
    available: true,
  },
  {
    id: 'voice',
    title: 'Ditado por Voz',
    description: 'Fale, vira anotação',
    icon: Mic,
    color: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400',
    available: true,
  },
  {
    id: 'atlas',
    title: 'Atlas de Dentes',
    description: 'Anatomia para o paciente',
    icon: Stethoscope,
    color: 'from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400',
    available: true,
  },
  {
    id: 'reference',
    title: 'Conversores e Tabelas',
    description: 'mL/tubete, ASA, EVA',
    icon: Clipboard,
    color: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400',
    available: true,
  },
];

const TOOL_DETAILS: Record<ToolId, { title: string; description: string }> = {
  anesthetic: {
    title: 'Calculadora de Anestésico',
    description: 'Cálculo da dose máxima segura por peso e tipo de fármaco.',
  },
  timer: {
    title: 'Timer de Procedimento',
    description: 'Cronômetro com presets para condicionamento, fotopolimerização e mais.',
  },
  return: {
    title: 'Próximo Retorno',
    description: 'Agende um retorno no próximo horário livre da sua agenda.',
  },
  prescription: { title: 'Receituário', description: '' },
  certificate: { title: 'Atestado', description: '' },
  photo: { title: 'Foto Clínica', description: '' },
  voice: { title: 'Ditado por Voz', description: '' },
  atlas: { title: 'Atlas de Dentes', description: '' },
  reference: { title: 'Conversores e Tabelas', description: '' },
};

export default function ToolsHome() {
  const { clinicCategory } = useAuth();
  const [open, setOpen] = useState<ToolId | null>(null);

  const isOdonto = clinicCategory === 'odonto';
  const visibleTools = TOOLS.filter((t) => t.id !== 'atlas' || isOdonto);

  const renderToolBody = (id: ToolId) => {
    switch (id) {
      case 'anesthetic':
        return <AnestheticCalculator />;
      case 'timer':
        return <ProcedureTimer />;
      case 'return':
        return <QuickReturn />;
      case 'prescription':
        return <PrescriptionPad />;
      case 'certificate':
        return <CertificateGenerator />;
      case 'photo':
        return <ClinicalCamera />;
      case 'voice':
        return <VoiceDictation />;
      case 'atlas':
        return <ToothAtlas />;
      case 'reference':
        return <QuickReference />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ferramentas Clínicas"
        description="Tudo que você usa no dia a dia em um só lugar — sem sair do IACLIN."
      />

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              disabled={!tool.available}
              onClick={() => tool.available && setOpen(tool.id)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 text-left transition-all',
                tool.available
                  ? 'hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                  : 'opacity-60 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br mb-3',
                  tool.color,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-sm sm:text-base font-semibold leading-tight">{tool.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{tool.description}</p>
              {!tool.available && (
                <span className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded">
                  em breve
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{TOOL_DETAILS[open].title}</DialogTitle>
                {TOOL_DETAILS[open].description && (
                  <DialogDescription>{TOOL_DETAILS[open].description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="pt-2">{renderToolBody(open)}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}