import { useState } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { ConsentDialog } from './ConsentDialog';
import { RecordingFloatingBar } from './RecordingFloatingBar';
import { FinishConfirmDialog } from './FinishConfirmDialog';
import { ProcessingOverlay, type ProcessingStep } from './ProcessingOverlay';
import { RecordingResultsDialog } from './RecordingResultsDialog';
import { applyAiResultToAttendance, type AiAttendanceResult, type AttendanceSetters } from '@/lib/applyAiResultToAttendance';

const SKIP_FINISH_KEY = 'recording.skipFinishConfirm';

interface Props {
  appointmentId: string;
  patientId: string;
  clinicalRecordId: string | null;
  clinicId: string | null;
  setters: AttendanceSetters;
}

export function RecordConsultationButton({ appointmentId, patientId, clinicalRecordId, clinicId, setters }: Props) {
  const { user } = useAuth();
  const recorder = useAudioRecorder();
  const [showConsent, setShowConsent] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('uploading');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(AiAttendanceResult & { transcript?: string }) | null>(null);
  const [showResults, setShowResults] = useState(false);

  const startRecordingFlow = async () => {
    if (!user) return;
    // Check consent
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
      await recorder.start();
    } catch (err) {
      toast.error('Não foi possível acessar o microfone: ' + (err as Error).message);
    }
  };

  const requestFinish = () => {
    if (localStorage.getItem(SKIP_FINISH_KEY) === '1') {
      void doFinish();
    } else {
      setShowFinish(true);
    }
  };

  const doFinish = async (dontAskAgain?: boolean) => {
    if (dontAskAgain) localStorage.setItem(SKIP_FINISH_KEY, '1');
    setShowFinish(false);
    if (!user) return;
    setProcessing(true);
    setStep('uploading');
    setProgress(10);
    try {
      const blob = await recorder.stop();
      if (!blob) throw new Error('Sem áudio gravado');
      const durationSeconds = Math.round(recorder.state.durationMs / 1000);

      // Insert recording row
      const { data: rec, error: insErr } = await supabase
        .from('consultation_recordings')
        .insert({
          appointment_id: appointmentId,
          clinical_record_id: clinicalRecordId,
          patient_id: patientId,
          dentist_id: user.id,
          clinic_id: clinicId,
          duration_seconds: durationSeconds,
          status: 'uploaded',
          consent_accepted_at: new Date().toISOString(),
        })
        .select('id').single();
      if (insErr || !rec) throw new Error(insErr?.message || 'Falha ao registrar gravação');
      setRecordingId(rec.id);

      const path = `${user.id}/${rec.id}.webm`;
      const { error: upErr } = await supabase.storage.from('consultation-audio')
        .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });
      if (upErr) throw upErr;

      await supabase.from('consultation_recordings').update({ audio_storage_path: path }).eq('id', rec.id);

      setStep('transcribing');
      setProgress(40);

      const { data: fnData, error: fnErr } = await supabase.functions.invoke('transcribe-consultation', {
        body: { recording_id: rec.id },
      });
      if (fnErr) throw fnErr;
      setStep('summarizing');
      setProgress(75);
      const aiResult = (fnData as any)?.result as (AiAttendanceResult & { transcript?: string });
      if (!aiResult) throw new Error('Resposta da IA vazia');

      setStep('structuring');
      setProgress(95);
      setResult(aiResult);
      setProgress(100);
      setTimeout(() => {
        setProcessing(false);
        setShowResults(true);
      }, 400);
    } catch (err) {
      setProcessing(false);
      toast.error('Falha ao processar consulta: ' + (err as Error).message);
    }
  };

  const handleApply = (edited: AiAttendanceResult) => {
    applyAiResultToAttendance(edited, setters);
    toast.success('Atendimento preenchido com IA. Revise antes de salvar.');
  };

  const isRecording = recorder.state.status === 'recording' || recorder.state.status === 'paused';

  return (
    <>
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={() => (isRecording ? requestFinish() : startRecordingFlow())}
      >
        <Mic className="h-4 w-4" />
        {isRecording ? 'Finalizar gravação' : 'Gravar consulta'}
      </Button>

      <ConsentDialog
        open={showConsent}
        onOpenChange={setShowConsent}
        onAccepted={() => { void beginRecording(); }}
      />

      {isRecording && (
        <RecordingFloatingBar
          state={recorder.state}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onFinish={requestFinish}
        />
      )}

      <FinishConfirmDialog
        open={showFinish}
        onOpenChange={setShowFinish}
        onConfirm={(dont) => { void doFinish(dont); }}
      />

      <ProcessingOverlay open={processing} step={step} progress={progress} />

      <RecordingResultsDialog
        open={showResults}
        onOpenChange={setShowResults}
        result={result}
        onApply={handleApply}
      />
    </>
  );
}