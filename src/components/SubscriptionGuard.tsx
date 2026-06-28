import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, AlertOctagon, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

/**
 * Bloqueio global por inadimplência da assinatura da clínica.
 * - Admin/Dono: pode acessar apenas /settings (para regularizar) e /perfil.
 * - Staff (dentista, secretária, auxiliar): bloqueio total com mensagem.
 */
export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clinicRole, isClinicOwner, signOut, profile } = useAuth();
  const { isOverdueOrCancelled, isLoading, status } = useSubscriptionStatus();

  if (isLoading) return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
  if (!isOverdueOrCancelled) return <>{children}</>;

  const isAdmin = isClinicOwner || clinicRole === 'admin';
  const allowedAdminPath =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/perfil');

  if (isAdmin && allowedAdminPath) {
    return (
      <div className="flex flex-col gap-3 min-h-0 flex-1">
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 font-medium">
            Assinatura suspensa — acesso restrito até a regularização do pagamento.
          </span>
        </div>
        {children}
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Assinatura suspensa</h1>
          <p className="text-sm text-muted-foreground mb-2">
            {profile?.full_name ? `Olá, ${profile.full_name.split(' ')[0]}. ` : ''}
            Identificamos uma pendência no pagamento da sua assinatura.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Regularize agora para reativar o acesso ao IACLIN.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/settings?tab=subscription')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Ir para pagamento
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
          {status === 'cancelled' && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              Sua assinatura foi cancelada. Reative na área de assinatura.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Staff
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertOctagon className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Sistema temporariamente indisponível</h1>
        <p className="text-sm text-muted-foreground mb-6">
          O acesso ao sistema está suspenso. Por favor, entre em contato com o administrador
          ou responsável pela clínica para regularizar o acesso.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}