import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, ArrowRight } from 'lucide-react';
import { useActiveConsultation } from '@/hooks/useActiveConsultation';
import { formatHMS } from '@/lib/formatDuration';

export function ActiveConsultationBar() {
  const active = useActiveConsultation();
  const location = useLocation();

  const onAttendance = location.pathname.startsWith('/atendimento/');
  const visible = !!active && !onAttendance;

  return (
    <AnimatePresence>
      {visible && active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-primary/30 bg-primary/10 backdrop-blur-sm"
        >
          <Link
            to={`/atendimento/${active.appointmentId}`}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-primary/15 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">
                Em consulta{active.patientName ? ` · ${active.patientName}` : ''}
              </span>
              <span className="font-mono tabular-nums text-primary">
                {formatHMS(active.elapsedSeconds)}
              </span>
              {active.isPaused && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">pausada</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium shrink-0">
              Voltar <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}