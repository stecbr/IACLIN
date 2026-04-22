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
      // 1. Find or create patient row in this clinic
      let patientId: string | null = null;

      // Try to find existing patient in this clinic linked to user
      const { data: existingByUser, error: findUserErr } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', selection.clinicId)
        .eq('patient_user_id', user.id)
        .maybeSingle();

      if (findUserErr) {
        console.error('[booking] find patient by user_id failed', findUserErr);
      }

      if (existingByUser) {
        patientId = existingByUser.id;
      } else if (account?.cpf) {
        // Try by CPF
        const { data: existingByCpf, error: findCpfErr } = await supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', selection.clinicId)
          .eq('cpf', account.cpf)
          .maybeSingle();

        if (findCpfErr) {
          console.error('[booking] find patient by cpf failed', findCpfErr);
        }

        if (existingByCpf) {
          patientId = existingByCpf.id;
          // Link it to user
          await supabase
            .from('patients')
            .update({ patient_user_id: user.id })
            .eq('id', patientId);
        }
      }

      if (!patientId) {
        // Create patient
        const { data: created, error: createErr } = await supabase
          .from('patients')
          .insert({
            clinic_id: selection.clinicId,
            full_name: account?.full_name ?? user.email ?? 'Paciente',
            cpf: account?.cpf ?? null,
            phone: account?.phone ?? null,
            email: user.email ?? null,
            date_of_birth: account?.date_of_birth ?? null,
            insurance_provider: account?.insurance_provider ?? null,
            insurance_number: account?.insurance_number ?? null,
            patient_user_id: user.id,
          })
          .select('id')
          .single();

        if (createErr || !created) {
          console.error('[booking] create patient failed', { error: createErr, payload: { clinic_id: selection.clinicId, cpf: account?.cpf, user_id: user.id } });
          throw new Error(`Falha ao criar paciente: ${createErr?.message ?? 'erro desconhecido'} (code: ${createErr?.code ?? 'n/a'})`);
        }
        patientId = created.id;
      }

      // 2. Create appointment
      const { error: apptErr } = await supabase.from('appointments').insert({
        patient_id: patientId,
        dentist_id: selection.dentistId,
        clinic_id: selection.clinicId,
        start_time: selection.startTime.toISOString(),
        end_time: selection.endTime.toISOString(),
        status: 'scheduled',
        label: specialty.name,
        notes: notes.trim() || null,
      });

      if (apptErr) {
        console.error('[booking] create appointment failed', { error: apptErr, patientId, dentistId: selection.dentistId, clinicId: selection.clinicId });
        throw new Error(`Falha ao criar agendamento: ${apptErr.message} (code: ${apptErr.code ?? 'n/a'})`);
      }

      toast.success('Consulta agendada com sucesso!', {
        description: `${specialty.name} em ${selection.clinicName}.`,
      });
      refetch();
      navigate('/paciente/agendas');
    } catch (err: any) {
      console.error('[booking] handleConfirm error:', err);
      toast.error('Não foi possível agendar', {
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
