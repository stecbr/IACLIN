import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAudioRecorder, type AudioRecorderState } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AiAttendanceResult, AttendanceSetters } from '@/lib/applyAiResultToAttendance';
import { applyAiResultToAttendance } from '@/lib/applyAiResultToAttendance';
import type { ProcessingStep } from '@/components/attendance/recording/ProcessingOverlay';
import { toast } from 'sonner';

export interface RecordingSession {
  appointmentId: string;
  patientId: string;
  clinicalRecordId: string | null;
  clinicId: string | null;
}

export type PendingAiResult = AiAttendanceResult & { transcript?: string };

interface RecordingContextValue {
  state: AudioRecorderState;
  session: RecordingSession | null;
  isRecording: boolean;
  // lifecycle
  start: (s: RecordingSession) => Promise<void>;
  pause: () => void;
  resume: () => void;
  requestFinish: () => void;
  cancel: () => Promise<void>;
  cancelProcessing: () => void;
  // finish-confirm dialog
  showFinishConfirm: boolean;
  setShowFinishConfirm: (open: boolean) => void;
  confirmFinish: (dontAskAgain?: boolean) => Promise<void>;
  // processing
  processing: boolean;
  processingStep: ProcessingStep;
  processingProgress: number;
  // result
  result: PendingAiResult | null;
  showResults: boolean;
  setShowResults: (open: boolean) => void;
  applyResult: (edited: AiAttendanceResult) => boolean;
  // setter registration (so the global bar can apply results to the right attendance)
  registerHandlers: (appointmentId: string, setters: AttendanceSetters) => void;
  unregisterHandlers: (appointmentId: string) => void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

const SKIP_FINISH_KEY = 'recording.skipFinishConfirm';
const PENDING_RESULT_KEY = (id: string) => `pending-ai-result:${id}`;
export const RECORDING_RESULT_EVENT = 'recording-result-ready';

export function RecordingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const recorder = useAudioRecorder();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('uploading');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState<PendingAiResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const handlersRef = useRef<Map<string, AttendanceSetters>>(new Map());
  const processingCanceledRef = useRef(false);

  const start = useCallback(async (s: RecordingSession) => {
    setSession(s);
    await recorder.start();
  }, [recorder]);

  const cancel = useCallback(async () => {
    try { await recorder.stop(); } catch { /* ignore */ }
    recorder.reset();
    setShowFinishConfirm(false);
    setProcessing(false);
    setSession(null);
  }, [recorder]);

  const cancelProcessing = useCallback(() => {
    processingCanceledRef.current = true;
    setProcessing(false);
    setResult(null);
    setShowResults(false);
    if (session) {
      try { sessionStorage.removeItem(PENDING_RESULT_KEY(session.appointmentId)); } catch {}
    }
    setSession(null);
    recorder.reset();
    toast.message('Processamento cancelado', { description: 'Você pode gravar novamente quando quiser.' });
  }, [recorder, session]);

  const requestFinish = useCallback(() => {
    if (localStorage.getItem(SKIP_FINISH_KEY) === '1') {
      void confirmFinish();
    } else {
      setShowFinishConfirm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmFinish = useCallback(async (dontAskAgain?: boolean) => {
    if (dontAskAgain) localStorage.setItem(SKIP_FINISH_KEY, '1');
    setShowFinishConfirm(false);
    if (!user || !session) return;
    processingCanceledRef.current = false;
    setProcessing(true);
    setProcessingStep('uploading');
    setProcessingProgress(10);
    try {
      const blob = await recorder.stop();
      if (processingCanceledRef.current) return;
      if (!blob) throw new Error('Sem áudio gravado');
      const durationSeconds = Math.round(recorder.state.durationMs / 1000);

      const { data: rec, error: insErr } = await supabase
        .from('consultation_recordings')
        .insert({
          appointment_id: session.appointmentId,
          clinical_record_id: session.clinicalRecordId,
          patient_id: session.patientId,
          dentist_id: user.id,
          clinic_id: session.clinicId,
          duration_seconds: durationSeconds,
          status: 'uploaded',
          consent_accepted_at: new Date().toISOString(),
        })
        .select('id').single();
      if (insErr || !rec) throw new Error(insErr?.message || 'Falha ao registrar gravação');

      const path = `${user.id}/${rec.id}.webm`;
      const { error: upErr } = await supabase.storage.from('consultation-audio')
        .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });
      if (upErr) throw upErr;
      if (processingCanceledRef.current) return;
      await supabase.from('consultation_recordings').update({ audio_storage_path: path }).eq('id', rec.id);

      setProcessingStep('transcribing');
      setProcessingProgress(40);

      const { data: fnData, error: fnErr } = await supabase.functions.invoke('transcribe-consultation', {
        body: { recording_id: rec.id },
      });
      if (processingCanceledRef.current) return;
      if (fnErr) throw fnErr;
      setProcessingStep('summarizing');
      setProcessingProgress(75);
      const aiResult = (fnData as any)?.result as PendingAiResult;
      if (!aiResult) throw new Error('Resposta da IA vazia');

      setProcessingStep('structuring');
      setProcessingProgress(95);
      setResult(aiResult);
      setProcessingProgress(100);

      // Stash the result keyed by appointment so the attendance page can re-open
      // the review dialog if the user navigated away during processing.
      try {
        sessionStorage.setItem(PENDING_RESULT_KEY(session.appointmentId), JSON.stringify(aiResult));
      } catch {}
      window.dispatchEvent(new CustomEvent(RECORDING_RESULT_EVENT, { detail: { appointmentId: session.appointmentId } }));

      setTimeout(() => {
        setProcessing(false);
        setShowResults(true);
      }, 400);
    } catch (err) {
      if (processingCanceledRef.current) return;
      setProcessing(false);
      setSession(null);
      recorder.reset();
      toast.error('Falha ao processar consulta: ' + (err as Error).message);
    }
  }, [recorder, session, user]);

  const applyResult = useCallback((edited: AiAttendanceResult) => {
    if (!session) return false;
    const setters = handlersRef.current.get(session.appointmentId);
    if (!setters) {
      toast.message('Abra o atendimento para aplicar', {
        description: 'O resumo da IA fica disponível assim que você abrir o atendimento correspondente.',
      });
      return false;
    }
    applyAiResultToAttendance(edited, setters);
    try { sessionStorage.removeItem(PENDING_RESULT_KEY(session.appointmentId)); } catch {}
    toast.success('Atendimento preenchido com IA. Revise antes de salvar.');
    // After applying, the recording lifecycle is complete: drop the session
    // and reset the recorder so the floating bar and stale state go away.
    setShowResults(false);
    setResult(null);
    setSession(null);
    recorder.reset();
    return true;
  }, [session, recorder]);

  // When the user closes the results dialog without applying, also wind down
  // the session so nothing keeps the "recording" UI alive.
  const handleSetShowResults = useCallback((open: boolean) => {
    setShowResults(open);
    if (!open) {
      setResult(null);
      setSession(null);
      recorder.reset();
    }
  }, [recorder]);

  const registerHandlers = useCallback((appointmentId: string, setters: AttendanceSetters) => {
    handlersRef.current.set(appointmentId, setters);
  }, []);
  const unregisterHandlers = useCallback((appointmentId: string) => {
    handlersRef.current.delete(appointmentId);
  }, []);

  // Warn user if they try to close the tab while a recording is in progress
  useEffect(() => {
    const isLive = recorder.state.status === 'recording' || recorder.state.status === 'paused';
    if (!isLive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [recorder.state.status]);

  // Auto-cancel any active recording when the user signs out so the
  // microphone is released and the floating bar disappears.
  const wasAuthed = useRef<boolean>(!!user);
  useEffect(() => {
    if (wasAuthed.current && !user) {
      void cancel();
    }
    wasAuthed.current = !!user;
  }, [user, cancel]);

  const value: RecordingContextValue = {
    state: recorder.state,
    session,
    // Only consider the recording "active" when there is a live session AND
    // the underlying MediaRecorder is actually capturing. This prevents the
    // floating bar from ever appearing when nothing has been started.
    isRecording: !!session && (recorder.state.status === 'recording' || recorder.state.status === 'paused'),
    start,
    pause: recorder.pause,
    resume: recorder.resume,
    requestFinish,
    cancel,
    cancelProcessing,
    showFinishConfirm,
    setShowFinishConfirm,
    confirmFinish,
    processing,
    processingStep,
    processingProgress,
    result,
    showResults,
    setShowResults: handleSetShowResults,
    applyResult,
    registerHandlers,
    unregisterHandlers,
  };

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error('useRecording must be used within RecordingProvider');
  return ctx;
}

export function readPendingRecordingResult(appointmentId: string): PendingAiResult | null {
  try {
    const raw = sessionStorage.getItem(PENDING_RESULT_KEY(appointmentId));
    if (!raw) return null;
    return JSON.parse(raw) as PendingAiResult;
  } catch { return null; }
}
export function clearPendingRecordingResult(appointmentId: string) {
  try { sessionStorage.removeItem(PENDING_RESULT_KEY(appointmentId)); } catch {}
}