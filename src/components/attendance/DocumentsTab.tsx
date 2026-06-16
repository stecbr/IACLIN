import { useState } from 'react';
import { FileText, Pill, Send, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrescriptionPad } from '@/components/dentist/tools/PrescriptionPad';
import { CertificateGenerator } from '@/components/dentist/tools/CertificateGenerator';
import { ReferralLetterPad } from '@/components/tools/ReferralLetterPad';
import { ExamRequestPad } from '@/components/tools/ExamRequestPad';

interface DocumentsTabProps {
  patientId: string;
}

const DOCS = [
  {
    id: 'prescription',
    label: 'Receituário',
    icon: Pill,
    description: 'Prescrição de medicamentos com modelos prontos',
    color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
  },
  {
    id: 'certificate',
    label: 'Atestado',
    icon: FileText,
    description: 'Comparecimento ou afastamento',
    color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
  },
  {
    id: 'referral',
    label: 'Encaminhamento',
    icon: Send,
    description: 'Carta de encaminhamento para especialidade',
    color: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10',
  },
  {
    id: 'exams',
    label: 'Solicitação de Exames',
    icon: ClipboardList,
    description: 'Requisição de exames laboratoriais ou de imagem',
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
  },
] as const;

type DocId = (typeof DOCS)[number]['id'];

export function DocumentsTab({ patientId }: DocumentsTabProps) {
  const [active, setActive] = useState<DocId>('prescription');

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DOCS.map((doc) => {
          const Icon = doc.icon;
          const isActive = active === doc.id;
          return (
            <button
              key={doc.id}
              onClick={() => setActive(doc.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                isActive
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <div className={cn('inline-flex items-center justify-center h-8 w-8 rounded-lg mb-2', doc.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold leading-tight">{doc.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug hidden sm:block">{doc.description}</p>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        {active === 'prescription' && <PrescriptionPad patientId={patientId} />}
        {active === 'certificate' && <CertificateGenerator patientId={patientId} />}
        {active === 'referral' && <ReferralLetterPad patientId={patientId} />}
        {active === 'exams' && <ExamRequestPad patientId={patientId} />}
      </div>
    </div>
  );
}
