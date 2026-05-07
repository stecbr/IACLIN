import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope } from 'lucide-react';
import { useActiveConsultation } from '@/hooks/useActiveConsultation';
import { formatHMS } from '@/lib/formatDuration';

export function FloatingConsultationButton() {
  const active = useActiveConsultation();
  const navigate = useNavigate();
  const location = useLocation();

  const onAttendance = location.pathname.startsWith('/atendimento/');
  const visible = !!active && !onAttendance;

  return (
    <AnimatePresence>
      {visible && active && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => navigate(`/atendimento/${active.appointmentId}`)}
          aria-label="Voltar à consulta em andamento"
          className="fixed right-4 bottom-24 md:bottom-6 z-40 h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex flex-col items-center justify-center gap-0.5 hover:scale-105 transition-transform"
        >
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          <Stethoscope className="relative h-5 w-5" />
          <span className="relative font-mono text-[10px] tabular-nums leading-none">
            {formatHMS(active.elapsedSeconds)}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}