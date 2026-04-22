import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePatientData } from '@/hooks/usePatientData';
import { BookingProgress } from '@/components/patient/booking/BookingProgress';
import { SpecialtyStep, type Specialty } from '@/components/patient/booking/SpecialtyStep';
import { DateStep } from '@/components/patient/booking/DateStep';
import { ClinicDoctorStep, type BookingSelection } from '@/components/patient/booking/ClinicDoctorStep';
import { SummaryStep } from '@/components/patient/booking/SummaryStep';

type Step = 1 | 2 | 3 | 4;

export default function PatientBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, refetch } = usePatientData();

  const [step, setStep] = useState<Step>(1);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
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
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success('Pedido enviado!', {
        description: `A ${selection.clinicName} vai confirmar sua consulta de ${specialty.name} em breve.`,
      });
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
    </div>
  );
}
