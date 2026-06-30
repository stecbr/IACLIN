import { AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  onChoose: () => void;
}

export function UnlinkedFromClinicBanner({ onChoose }: Props) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        Você foi desvinculado da clínica anterior. Escolha como continuar usando o IACLIN.
      </span>
      <button
        type="button"
        onClick={onChoose}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium transition-colors"
      >
        Escolher opção
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}