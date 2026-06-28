import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

const DISMISS_KEY = 'iaclin.subWarn.dismissed';

export function SubscriptionWarningBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicRole, isClinicOwner } = useAuth();
  const { isActive, isTrial, daysUntilDue, isOverdueOrCancelled } = useSubscriptionStatus();

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const isAdmin = isClinicOwner || clinicRole === 'admin';
  const onSettings = location.pathname.startsWith('/settings');

  if (!isAdmin) return null;
  if (isOverdueOrCancelled) return null;
  if (!isActive) return null;
  if (daysUntilDue === null || daysUntilDue > 7) return null;
  if (dismissed) return null;
  if (onSettings) return null;

  const message = (() => {
    if (daysUntilDue <= 0) {
      return isTrial
        ? 'Seu período de testes termina hoje. Ative seu plano para evitar o bloqueio.'
        : 'Sua assinatura vence hoje. Regularize para evitar o bloqueio.';
    }
    const dias = daysUntilDue === 1 ? '1 dia' : `${daysUntilDue} dias`;
    return isTrial
      ? `Seu período de testes termina em ${dias}. Ative seu plano para evitar o bloqueio.`
      : `Sua assinatura vence em ${dias}. Regularize para evitar o bloqueio.`;
  })();

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={() => navigate('/settings?tab=subscription')}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium transition-colors"
        >
          Regularizar
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar"
          className="rounded-md p-1 text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}