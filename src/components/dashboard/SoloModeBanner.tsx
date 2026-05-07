import { Sparkles, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSoloMode } from '@/hooks/useSoloMode';

const DISMISS_KEY = 'iaclin.soloBannerDismissed';

export function SoloModeBanner() {
  const { isSolo } = useSoloMode();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (!isSolo || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center justify-center transition-colors"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Modo consultório individual</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Você atende e gerencia tudo sozinho. Quando quiser, convide uma secretária ou outro profissional.
          </p>
        </div>
        <Link
          to="/settings"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 whitespace-nowrap"
        >
          <UserPlus className="h-3.5 w-3.5" /> Convidar equipe
        </Link>
      </div>
    </div>
  );
}
