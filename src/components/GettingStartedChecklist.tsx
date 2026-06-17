import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Building2,
  Users,
  UserPlus,
  FileText,
  Calendar,
  Stethoscope,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface ChecklistItem {
  key: string;
  label: string;
  to: string;
  icon: typeof Building2;
  done: boolean;
}

const STORAGE_KEY_PREFIX = 'iaclin.gettingStarted';

/**
 * Floating "Comece aqui" checklist for new clinics. Shows a small card at the
 * bottom-left, expandable, with quick links to the place where each task is
 * done. Auto-detects completion from the database; auto-hides once 100% is
 * reached or the user dismisses it.
 */
export function GettingStartedChecklist() {
  const location = useLocation();
  const { currentClinicId, isPersonalMode } = useAuth();
  const { effectiveRole } = useRoleAccess();

  const storageKey = currentClinicId
    ? `${STORAGE_KEY_PREFIX}.${currentClinicId}`
    : null;

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !storageKey) return false;
    return localStorage.getItem(`${storageKey}.dismissed`) === '1';
  });

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(`${storageKey}.dismissed`) === '1');
  }, [storageKey]);

  // Hide on routes outside of the admin app.
  const hiddenRoutes = ['/auth', '/onboarding', '/superadmin', '/operadora', '/paciente', '/marketplace'];
  const onHiddenRoute = hiddenRoutes.some((r) => location.pathname.startsWith(r));

  const canSee =
    !!currentClinicId &&
    !isPersonalMode &&
    (effectiveRole === 'admin' || effectiveRole === 'owner') &&
    !onHiddenRoute;

  const { data: progress } = useQuery({
    queryKey: ['getting-started', currentClinicId],
    enabled: canSee,
    queryFn: async () => {
      const [clinic, members, patients, budgets, appts, procedures] = await Promise.all([
        supabase
          .from('clinics')
          .select('phone, address, business_hours')
          .eq('id', currentClinicId!)
          .maybeSingle(),
        supabase
          .from('clinic_members')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!)
          .eq('role', 'dentist'),
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
        supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
        supabase
          .from('procedures')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
      ]);

      const c: any = clinic.data ?? {};
      const clinicConfigured = !!(c.phone && c.address && c.business_hours);

      return {
        clinicConfigured,
        hasTeam: (members.count ?? 0) > 0,
        hasPatient: (patients.count ?? 0) > 0,
        hasProcedure: (procedures.count ?? 0) > 0,
        hasBudget: (budgets.count ?? 0) > 0,
        hasAppointment: (appts.count ?? 0) > 0,
      };
    },
    staleTime: 30_000,
  });

  const items: ChecklistItem[] = useMemo(
    () => [
      {
        key: 'clinic',
        label: 'Configure os dados da clínica',
        to: '/settings?section=clinic',
        icon: Building2,
        done: !!progress?.clinicConfigured,
      },
      {
        key: 'team',
        label: 'Cadastre sua equipe',
        to: '/clinica/medicos',
        icon: Stethoscope,
        done: !!progress?.hasTeam,
      },
      {
        key: 'procedure',
        label: 'Cadastre um procedimento',
        to: '/settings?section=catalog',
        icon: FileText,
        done: !!progress?.hasProcedure,
      },
      {
        key: 'patient',
        label: 'Cadastre um paciente',
        to: '/patients',
        icon: Users,
        done: !!progress?.hasPatient,
      },
      {
        key: 'budget',
        label: 'Crie um orçamento',
        to: '/budgets',
        icon: UserPlus,
        done: !!progress?.hasBudget,
      },
      {
        key: 'appointment',
        label: 'Agende uma consulta',
        to: '/agenda',
        icon: Calendar,
        done: !!progress?.hasAppointment,
      },
    ],
    [progress],
  );

  const totalDone = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((totalDone / items.length) * 100) : 0;

  const dismiss = () => {
    if (storageKey) localStorage.setItem(`${storageKey}.dismissed`, '1');
    setDismissed(true);
    setOpen(false);
  };

  if (!canSee || dismissed || !progress) return null;
  // Auto-hide once everything is done.
  if (pct === 100) {
    if (storageKey && localStorage.getItem(`${storageKey}.dismissed`) !== '1') {
      localStorage.setItem(`${storageKey}.dismissed`, '1');
    }
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-40 pointer-events-none">
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-sm">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Comece por aqui
            </p>
            <p className="text-xs text-muted-foreground">
              {totalDone} de {items.length} concluído{totalDone === 1 ? '' : 's'}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary tabular-nums">{pct}%</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Items */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <ul className="p-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 ${
                          item.done ? 'opacity-60' : ''
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            item.done
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'border-border bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          {item.done ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Icon className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span
                          className={`flex-1 ${
                            item.done ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/20">
                <span className="text-[11px] text-muted-foreground">
                  Marcado automaticamente ao concluir cada etapa
                </span>
                <button
                  onClick={dismiss}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Dispensar"
                >
                  <X className="h-3 w-3" /> Dispensar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}