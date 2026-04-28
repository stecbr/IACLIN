import { useState } from 'react';
import { Brain, ClipboardList, FileText, Mic, Smile, Timer, Library } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PsiScales } from '@/components/psi/PsiScales';
import { MoodDiary } from '@/components/psi/MoodDiary';
import { SoapNote } from '@/components/psi/SoapNote';
import { SessionTimer } from '@/components/psi/SessionTimer';
import { PsiReference } from '@/components/psi/PsiReference';
import { VoiceDictation } from '@/components/dentist/tools/VoiceDictation';
import { cn } from '@/lib/utils';

type ToolId = 'scales' | 'mood' | 'soap' | 'timer' | 'reference' | 'voice';

const TOOLS: Array<{ id: ToolId; title: string; description: string; icon: typeof Brain; color: string }> = [
  { id: 'scales', title: 'Escalas Clínicas', description: 'PHQ-9, GAD-7, PSS-10, AUDIT, C-SSRS', icon: ClipboardList, color: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400' },
  { id: 'mood', title: 'Diário de Humor', description: 'Humor, sono, energia, ansiedade', icon: Smile, color: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
  { id: 'soap', title: 'Evolução SOAP', description: 'Subjetivo, Objetivo, Avaliação, Plano', icon: FileText, color: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400' },
  { id: 'timer', title: 'Timer de Sessão', description: '30/50/80/90 min com aviso', icon: Timer, color: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400' },
  { id: 'voice', title: 'Ditado por Voz', description: 'Fale, vira anotação', icon: Mic, color: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400' },
  { id: 'reference', title: 'DSM-5 e Tabelas', description: 'Critérios, EVA, pontos de corte', icon: Library, color: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400' },
];

const TITLES: Record<ToolId, string> = {
  scales: 'Escalas Clínicas',
  mood: 'Diário de Humor',
  soap: 'Evolução SOAP',
  timer: 'Timer de Sessão',
  voice: 'Ditado por Voz',
  reference: 'Referência Rápida',
};

export default function PsiToolsHome() {
  const [open, setOpen] = useState<ToolId | null>(null);

  const renderBody = (id: ToolId) => {
    switch (id) {
      case 'scales': return <PsiScales />;
      case 'mood': return <MoodDiary />;
      case 'soap': return <SoapNote />;
      case 'timer': return <SessionTimer />;
      case 'voice': return <VoiceDictation />;
      case 'reference': return <PsiReference />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ferramentas do Psicólogo"
        description="Escalas validadas, evolução estruturada e referência clínica — tudo em um só lugar."
      />
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setOpen(t.id)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 text-left transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className={cn('inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br mb-3', t.color)}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-sm sm:text-base font-semibold leading-tight">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{t.description}</p>
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader><DialogTitle>{TITLES[open]}</DialogTitle></DialogHeader>
              <div className="pt-2">{renderBody(open)}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
