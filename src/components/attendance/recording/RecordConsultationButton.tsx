import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConsentDialog } from './ConsentDialog';
import type { AttendanceSetters } from '@/lib/applyAiResultToAttendance';
import {
  useRecording,
  readPendingRecordingResult,
  clearPendingRecordingResult,
  RECORDING_RESULT_EVENT,
} from '@/contexts/RecordingContext';

interface Props {
  appointmentId: string;
  patientId: string;
  clinicalRecordId: string | null;
  clinicId: string | null;
  setters: AttendanceSetters;
}

export function RecordConsultationButton({ appointmentId, patientId, clinicalRecordId, clinicId, setters }: Props) {
  const { user } = useAuth();
  const recording = useRecording();
  const [showConsent, setShowConsent] = useState(false);

  // Register this attendance's setters with the global recording context so
  // the result dialog (which lives at the app root) can apply changes to the
  // form even after the user navigated away and back.
  useEffect(() => {
    recording.registerHandlers(appointmentId, setters);
    return () => recording.unregisterHandlers(appointmentId);
  }, [appointmentId, recording, setters]);

  // If a recording finished while the user was on another page, re-open the
  // results dialog when they come back to the corresponding attendance.
  useEffect(() => {
    const reopen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.appointmentId !== appointmentId) return;
      if (readPendingRecordingResult(appointmentId)) {
        recording.setShowResults(true);
      }
    };
    window.addEventListener(RECORDING_RESULT_EVENT, reopen);
    // Mount-time check: a recording could have completed before this page mounted.
    if (readPendingRecordingResult(appointmentId) && recording.result && recording.session?.appointmentId === appointmentId) {
      recording.setShowResults(true);
    }
    return () => window.removeEventListener(RECORDING_RESULT_EVENT, reopen);
  }, [appointmentId, recording]);

  const startRecordingFlow = async () => {
    if (!user) return;
    const { data: consent } = await supabase
      .from('user_consents').select('id')
      .eq('user_id', user.id).eq('consent_type', 'recording_terms').maybeSingle();
    if (!consent) {
      setShowConsent(true);
      return;
    }
    await beginRecording();
  };

  const beginRecording = async () => {
    try {
      await recording.start({ appointmentId, patientId, clinicalRecordId, clinicId });
    } catch (err) {
      toast.error('Não foi possível acessar o microfone: ' + (err as Error).message);
    }
  };

  // This button is "active" only when the current global recording session
  // belongs to *this* attendance. Other attendances see an idle button while
  // someone else's session is running (rare, but safe).
  const ownsSession = recording.session?.appointmentId === appointmentId;
  const isRecording = ownsSession && recording.isRecording;

  return (
    <>
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={() => (isRecording ? recording.requestFinish() : startRecordingFlow())}
        disabled={!ownsSession && recording.isRecording}
      >
        <Mic className="h-4 w-4" />
        {isRecording ? 'Finalizar gravação' : 'Gravar consulta'}
      </Button>

      <ConsentDialog
        open={showConsent}
        onOpenChange={setShowConsent}
        onAccepted={() => { void beginRecording(); }}
      />
    </>
  );
}