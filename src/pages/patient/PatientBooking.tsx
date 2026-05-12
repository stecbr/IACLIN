import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePatientData } from '@/hooks/usePatientData';
import { BookingProgress } from '@/components/patient/booking/BookingProgress';
import { SpecialtyStep, type Specialty } from '@/components/patient/booking/SpecialtyStep';
import { DateStep } from '@/components/patient/booking/DateStep';
import { ClinicDoctorStep, type BookingSelection } from '@/components/patient/booking/ClinicDoctorStep';
import { SummaryStep } from '@/components/patient/booking/SummaryStep';
import { BookingFilters, type BookingFiltersValue } from '@/components/patient/booking/BookingFilters';
import { format } from 'date-fns';

type Step = 1 | 2 | 3 | 4;

type ConflictInfo = {
  message: string;
  existing: {
    kind: 'appointment' | 'request';
    id: string;
    dentistName: string;
    startTime: string;
    endTime: string;
  };
};

export default function PatientBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch } = usePatientData();

  const [step, setStep] = useState<Step>(1);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [filters, setFilters] = useState<BookingFiltersValue>(() => {
    try {
      const raw = localStorage.getItem('patient_booking_filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { state: null, city: null, insurancePlanId: null, ...parsed };
      }
    } catch { /* ignore */ }
    return { state: null, city: null, insurancePlanId: null };
  });

  const updateFilters = (next: BookingFiltersValue) => {
    setFilters(next);
    try { localStorage.setItem('patient_booking_filters', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const submitBooking = async (replace?: { id: string; kind: 'appointment' | 'request' }) => {
    if (!selection || !specialty || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-appointment', {
        body: {
          clinicId: selection.clinicId,
          dentistId: selection.dentistId,
          specialty: specialty.id,
          startTime: selection.startTime.toISOString(),
          endTime: selection.endTime.toISOString(),
          notes: notes.trim() || null,
          ...(replace ? { replaceExistingId: replace.id, replaceKind: replace.kind } : {}),
        },
      });

      // Detect structured conflict (patient overlap) -> open confirmation dialog.
      // supabase.functions.invoke returns FunctionsHttpError whose `context` is a Response on non-2xx.
      const payload = (data as any) ?? null;
      let conflictPayload: any = null;
      let parsedError: any = null;
      if (error) {
        const ctx: any = (error as any)?.context;
        try {
          if (ctx && typeof ctx.clone === 'function') {
            parsedError = await ctx.clone().json();
          } else if (ctx?.body) {
            parsedError = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
          }
        } catch {
          /* ignore parse errors */
        }
        if (parsedError?.conflict) conflictPayload = parsedError;
      } else if (payload?.conflict) {
        conflictPayload = payload;
      }

      if (conflictPayload && !replace) {
        setConflict({
          message: conflictPayload.message,
          existing: conflictPayload.existing,
        });
        return;
      }

      if (error) {
        throw new Error(parsedError?.error ?? (error as any).message ?? 'Erro ao agendar');
      }
      if (payload?.error) throw new Error(payload.error);

      toast.success(replace ? 'Consulta reagendada!' : 'Pedido enviado!', {
        description: replace
          ? `Sua consulta anterior foi cancelada e o novo horário foi enviado para confirmação.`
          : `A ${selection.clinicName} vai confirmar sua consulta de ${specialty.name} em breve.`,
      });
      setConflict(null);
      refetch();
      navigate('/paciente/agendas');
    } catch (err: any) {
      console.error('[booking] handleConfirm error:', err);
      toast.error('Não foi possível solicitar agendamento', {
        description: err?.message ?? err?.error_description ?? 'Tente novamente em instantes.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => submitBooking();

  const handleConfirmReplace = () => {
    if (!conflict) return;
    submitBooking({ id: conflict.existing.id, kind: conflict.existing.kind });
  };

  const goBack = () => {
    if (step === 1) {
      navigate('/paciente');
    } else {
      setStep((s) => (s - 1) as Step);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} className="flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Agendar consulta</h1>
          <p className="text-sm text-muted-foreground">Escolha especialidade, data e profissional.</p>
        </div>
      </div>

      <BookingProgress step={step} />

      <BookingFilters value={filters} onChange={updateFilters} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {step === 1 && (
            <SpecialtyStep
              onSelect={(s) => {
                setSpecialty(s);
                setStep(2);
              }}
            />
          )}
          {step === 2 && specialty && (
            <DateStep
              specialty={specialty}
              selectedDate={date}
              onSelect={(d) => {
                setDate(d);
                setStep(3);
              }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && specialty && date && (
            <ClinicDoctorStep
              specialty={specialty}
              date={date}
              selected={selection}
              cityFilter={filters.city}
              insurancePlanId={filters.insurancePlanId}
              onSelect={(sel) => {
                setSelection(sel);
                // Move to step 4 once we have a slot
                setStep(4);
              }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && specialty && selection && (
            <SummaryStep
              specialty={specialty}
              selection={selection}
              notes={notes}
              onNotesChange={setNotes}
              onConfirm={handleConfirm}
              onBack={() => setStep(3)}
              loading={submitting}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <AlertDialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você já tem consulta com este profissional</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict ? (
                <>
                  Sua consulta/pedido com <strong>Dr(a). {conflict.existing.dentistName}</strong> em{' '}
                  <strong>{format(new Date(conflict.existing.startTime), "dd/MM 'às' HH:mm")}</strong>{' '}
                  será <strong>cancelada</strong> e substituída pelo novo horário{' '}
                  {selection && (
                    <>
                      (<strong>{format(selection.startTime, 'HH:mm')}</strong>)
                    </>
                  )}
                  . Você perderá o horário anterior. Deseja continuar?
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Manter atual</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace} disabled={submitting}>
              Sim, reagendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
