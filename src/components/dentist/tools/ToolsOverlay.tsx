import { useState } from 'react';
import { Wrench, X, Syringe, Timer, Mic, Pill } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AnestheticCalculator } from './AnestheticCalculator';
import { ProcedureTimer } from './ProcedureTimer';
import { VoiceDictation } from './VoiceDictation';
import { PrescriptionPad } from './PrescriptionPad';
import { cn } from '@/lib/utils';

type ToolKey = 'anesthetic' | 'timer' | 'voice' | 'rx';

interface ToolsOverlayProps {
  patientId?: string;
  clinicalRecordId?: string | null;
}

const TOOLS: Array<{ key: ToolKey; label: string; icon: typeof Syringe; color: string }> = [
  { key: 'anesthetic', label: 'Anestésico', icon: Syringe, color: 'bg-rose-500' },
  { key: 'timer', label: 'Timer', icon: Timer, color: 'bg-amber-500' },
  { key: 'voice', label: 'Ditado', icon: Mic, color: 'bg-blue-500' },
  { key: 'rx', label: 'Receita', icon: Pill, color: 'bg-sky-500' },
];

export function ToolsOverlay({ patientId, clinicalRecordId }: ToolsOverlayProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ToolKey | null>(null);

  const renderTool = (k: ToolKey) => {
    switch (k) {
      case 'anesthetic': return <AnestheticCalculator />;
      case 'timer': return <ProcedureTimer />;
      case 'voice': return <VoiceDictation clinicalRecordId={clinicalRecordId} />;
      case 'rx': return <PrescriptionPad patientId={patientId} />;
    }
  };

  const labels: Record<ToolKey, string> = {
    anesthetic: 'Calculadora de Anestésico',
    timer: 'Timer de Procedimento',
    voice: 'Ditado por Voz',
    rx: 'Receituário',
  };

  return (
    <>
      {/* Expanded tool buttons */}
      <div className={cn(
        'fixed bottom-24 right-4 z-40 flex flex-col-reverse gap-2 transition-all',
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      )}>
        {TOOLS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setActive(t.key); setOpen(false); }}
              className={cn('flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-white shadow-lg transition-all hover:scale-105', t.color)}
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-4 z-40 h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all',
          open ? 'bg-destructive text-destructive-foreground rotate-90' : 'bg-primary text-primary-foreground hover:scale-105'
        )}
        aria-label="Ferramentas clínicas"
      >
        {open ? <X className="h-6 w-6" /> : <Wrench className="h-6 w-6" />}
      </button>

      <Sheet open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{labels[active]}</SheetTitle>
              </SheetHeader>
              {renderTool(active)}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}