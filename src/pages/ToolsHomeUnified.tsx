import { useMemo, useState } from 'react';
import {
  Pill, FileText, ClipboardList, Send,
  Heart, BookOpen, Search,
  Mic, Timer, CalendarPlus, Camera,
  Sparkles, Brain, ClipboardCheck, Smile, Library, Apple,
  Syringe, Stethoscope, Clipboard,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { cn } from '@/lib/utils';

// Existing tools (reused)
import { PrescriptionPad } from '@/components/dentist/tools/PrescriptionPad';
import { CertificateGenerator } from '@/components/dentist/tools/CertificateGenerator';
import { ClinicalCamera } from '@/components/dentist/tools/ClinicalCamera';
import { VoiceDictation } from '@/components/dentist/tools/VoiceDictation';
import { ProcedureTimer } from '@/components/dentist/tools/ProcedureTimer';
import { QuickReturn } from '@/components/dentist/tools/QuickReturn';
import { AnestheticCalculator } from '@/components/dentist/tools/AnestheticCalculator';
import { ToothAtlas } from '@/components/dentist/tools/ToothAtlas';
import { QuickReference } from '@/components/dentist/tools/QuickReference';
import { BotoxCalculator } from '@/components/aesthetic/BotoxCalculator';
import { FacialAreasReference } from '@/components/aesthetic/FacialAreasReference';
import { PsiScales } from '@/components/psi/PsiScales';
import { MoodDiary } from '@/components/psi/MoodDiary';
import { SoapNote } from '@/components/psi/SoapNote';
import { SessionTimer } from '@/components/psi/SessionTimer';
import { PsiReference } from '@/components/psi/PsiReference';
import { BmiCalculator } from '@/components/family-tools/BmiCalculator';

// New tools
import { ExamRequestPad } from '@/components/tools/ExamRequestPad';
import { ReferralLetterPad } from '@/components/tools/ReferralLetterPad';
import { Cid10Search } from '@/components/tools/Cid10Search';
import { VitalSignsQuick } from '@/components/tools/VitalSignsQuick';

type SectionKey = 'documentos' | 'calculos' | 'produtividade' | 'especialidade' | 'odonto';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  section: SectionKey;
  render: () => JSX.Element;
  modalTitle?: string;
  modalDescription?: string;
}

const SHARED_TOOLS: Tool[] = [
  // Documentos
  { id: 'prescription', title: 'Receituário', description: 'Modelos prontos + PDF', icon: Pill, color: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400', section: 'documentos', render: () => <PrescriptionPad /> },
  { id: 'certificate', title: 'Atestado', description: 'Comparecimento e afastamento', icon: FileText, color: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400', section: 'documentos', render: () => <CertificateGenerator /> },
  { id: 'exam-request', title: 'Solicitação de Exames', description: 'Modelos + PDF + WhatsApp', icon: ClipboardList, color: 'from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400', section: 'documentos', render: () => <ExamRequestPad /> },
  { id: 'referral', title: 'Encaminhamento', description: 'Carta para outra especialidade', icon: Send, color: 'from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400', section: 'documentos', render: () => <ReferralLetterPad /> },

  // Cálculos
  { id: 'vitals', title: 'IMC + Sinais Vitais', description: 'PA, FC, FR, SpO₂, IMC', icon: Heart, color: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400', section: 'calculos', render: () => <VitalSignsQuick /> },
  { id: 'cid10', title: 'CID-10 Buscável', description: 'Busca rápida por código ou descrição', icon: Search, color: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400', section: 'calculos', render: () => <Cid10Search /> },

  // Produtividade
  { id: 'voice', title: 'Ditado por Voz', description: 'Fale, vira anotação', icon: Mic, color: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400', section: 'produtividade', render: () => <VoiceDictation /> },
  { id: 'timer', title: 'Timer de Atendimento', description: 'Cronômetro com presets', icon: Timer, color: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400', section: 'produtividade', render: () => <ProcedureTimer /> },
  { id: 'return', title: 'Próximo Retorno', description: 'Agendar retorno em 1 clique', icon: CalendarPlus, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400', section: 'produtividade', render: () => <QuickReturn /> },
  { id: 'photo', title: 'Foto Clínica', description: 'Antes/depois pela câmera', icon: Camera, color: 'from-pink-500/15 to-pink-500/5 text-pink-600 dark:text-pink-400', section: 'produtividade', render: () => <ClinicalCamera /> },
];

const ODONTO_TOOLS: Tool[] = [
  { id: 'anesthetic', title: 'Calculadora de Anestésico', description: 'Dose máxima por peso e fármaco', icon: Syringe, color: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400', section: 'odonto', render: () => <AnestheticCalculator /> },
  { id: 'atlas', title: 'Atlas de Dentes', description: 'Anatomia para o paciente', icon: Stethoscope, color: 'from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400', section: 'odonto', render: () => <ToothAtlas /> },
  { id: 'odonto-ref', title: 'Conversores Odonto', description: 'mL/tubete, ASA, EVA', icon: Clipboard, color: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400', section: 'odonto', render: () => <QuickReference /> },
];

function buildSpecialtyTools(family: string): Tool[] {
  if (family === 'aesthetic') {
    return [
      { id: 'botox', title: 'Calculadora de Toxina', description: 'Unidades por região facial', icon: Syringe, color: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400', section: 'especialidade', render: () => <BotoxCalculator /> },
      { id: 'facial-areas', title: 'Áreas Faciais', description: 'Preenchedor e peelings', icon: Library, color: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400', section: 'especialidade', render: () => <FacialAreasReference /> },
    ];
  }
  if (family === 'psi') {
    return [
      { id: 'psi-scales', title: 'Escalas Clínicas', description: 'PHQ-9, GAD-7, PSS-10, AUDIT, C-SSRS', icon: ClipboardCheck, color: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400', section: 'especialidade', render: () => <PsiScales /> },
      { id: 'psi-mood', title: 'Diário de Humor', description: 'Humor, sono, energia, ansiedade', icon: Smile, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400', section: 'especialidade', render: () => <MoodDiary /> },
      { id: 'psi-soap', title: 'Evolução SOAP', description: 'Subjetivo, Objetivo, Avaliação, Plano', icon: FileText, color: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400', section: 'especialidade', render: () => <SoapNote /> },
      { id: 'psi-timer', title: 'Timer de Sessão', description: '30/50/80/90 min', icon: Timer, color: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400', section: 'especialidade', render: () => <SessionTimer /> },
      { id: 'psi-ref', title: 'DSM-5 e Tabelas', description: 'Critérios, EVA, pontos de corte', icon: BookOpen, color: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400', section: 'especialidade', render: () => <PsiReference /> },
    ];
  }
  if (family === 'nutrition') {
    return [
      { id: 'bmi-nutrition', title: 'IMC + Antropometria', description: 'Peso, altura, circunferências', icon: Apple, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400', section: 'especialidade', render: () => <BmiCalculator family="nutrition" /> },
    ];
  }
  // medical / physio / podology / generic share VitalSignsQuick (already in shared)
  return [];
}

const SECTIONS: Array<{ key: SectionKey; title: string }> = [
  { key: 'documentos', title: 'Documentos' },
  { key: 'calculos', title: 'Cálculos clínicos' },
  { key: 'produtividade', title: 'Produtividade' },
  { key: 'especialidade', title: 'Especialidade' },
  { key: 'odonto', title: 'Odontologia' },
];

export default function ToolsHomeUnified() {
  const { profile } = useSpecialtyProfile();
  const family = profile.family;
  const isOdonto = family === 'odonto';

  const allTools: Tool[] = useMemo(() => {
    const tools = [...SHARED_TOOLS, ...buildSpecialtyTools(family)];
    if (isOdonto) tools.push(...ODONTO_TOOLS);
    return tools;
  }, [family, isOdonto]);

  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<SectionKey | 'all'>('all');

  const activeTool = allTools.find((t) => t.id === open);

  const visibleSections = SECTIONS.filter((s) => allTools.some((t) => t.section === s.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ferramentas Clínicas"
        description={`Tudo que você usa no dia a dia${profile.config.label ? ` em ${profile.config.label}` : ''} — em um só lugar.`}
      >
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> {profile.config.label}
        </div>
      </PageHeader>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterChip>
        {visibleSections.map((s) => (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
            <span className="mr-1">{s.icon}</span>{s.title}
          </FilterChip>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {visibleSections
          .filter((s) => filter === 'all' || filter === s.key)
          .map((section) => {
            const items = allTools.filter((t) => t.section === section.key);
            if (items.length === 0) return null;
            return (
              <section key={section.key} className="space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold flex items-center gap-2">
                  {section.title}
                  {section.key === 'odonto' && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                      Odonto
                    </span>
                  )}
                </h2>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setOpen(tool.id)}
                        className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 text-left transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
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
              </section>
            );
          })}
      </div>

      <Dialog open={!!activeTool} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {activeTool && (
            <>
              <DialogHeader>
                <DialogTitle>{activeTool.modalTitle ?? activeTool.title}</DialogTitle>
                {activeTool.modalDescription && (
                  <DialogDescription>{activeTool.modalDescription}</DialogDescription>
                )}
              </DialogHeader>
              <div className="pt-2">{activeTool.render()}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  );
}
