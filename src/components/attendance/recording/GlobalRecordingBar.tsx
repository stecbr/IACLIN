import { RecordingFloatingBar } from './RecordingFloatingBar';
import { FinishConfirmDialog } from './FinishConfirmDialog';
import { ProcessingOverlay } from './ProcessingOverlay';
import { RecordingResultsDialog } from './RecordingResultsDialog';
import { useRecording } from '@/contexts/RecordingContext';

/**
 * Mounted once at the app root so the recording UI persists across navigation.
 * The actual audio capture lives in RecordingContext.
 */
export function GlobalRecordingBar() {
  const r = useRecording();
  return (
    <>
      {r.isRecording && (
        <RecordingFloatingBar
          state={r.state}
          onPause={r.pause}
          onResume={r.resume}
          onFinish={r.requestFinish}
        />
      )}
      <FinishConfirmDialog
        open={r.showFinishConfirm}
        onOpenChange={r.setShowFinishConfirm}
        onConfirm={(dont) => { void r.confirmFinish(dont); }}
        onDiscard={() => { void r.cancel(); }}
      />
      <ProcessingOverlay open={r.processing} step={r.processingStep} progress={r.processingProgress} />
      <RecordingResultsDialog
        open={r.showResults}
        onOpenChange={r.setShowResults}
        result={r.result}
        onApply={(edited) => { r.applyResult(edited); }}
      />
    </>
  );
}