import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Mostrado quando um profissional perdeu o vínculo com todas as clínicas
 * (foi removido pelo dono ou ainda não criou a própria). Sugere criar a
 * clínica própria para passar a operar em modo Solo/Autônomo.
 */
export function SoloTransitionBanner() {
  const { clinics, clinicsLoaded, isPatient, isOperator, isPersonalMode, user } = useAuth();

  if (!user || !clinicsLoaded) return null;
  if (isPatient || isOperator || isPersonalMode) return null;
  if (clinics.length > 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 mb-3 text-sm">
      <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">Você não está vinculado a nenhuma clínica</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Crie sua própria clínica para começar a atender em modo autônomo: agenda, pacientes e
          financeiro totalmente isolados.
        </p>
      </div>
      <Link
        to="/onboarding"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 whitespace-nowrap"
      >
        Criar minha clínica
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}