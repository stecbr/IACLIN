import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioRecorderState {
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  durationMs: number;
  level: number; // 0..1 RMS para waveform
  error: string | null;
}

/**
 * Gravação de áudio via MediaRecorder + AnalyserNode (waveform/level).
 * Output: Blob webm/opus quando suportado.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    status: 'idle', durationMs: 0, level: 0, error: null,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    rafRef.current = null;
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setState((s) => ({ ...s, level: Math.min(1, rms * 2.5) }));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;

      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;

      tickRef.current = window.setInterval(() => {
        const now = Date.now();
        const dur = now - startedAtRef.current - pausedAccumRef.current;
        setState((s) => ({ ...s, durationMs: dur }));
      }, 250);

      setState({ status: 'recording', durationMs: 0, level: 0, error: null });
    } catch (err) {
      cleanup();
      setState({ status: 'idle', durationMs: 0, level: 0, error: (err as Error).message });
      throw err;
    }
  }, [cleanup]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      pausedAtRef.current = Date.now();
      setState((s) => ({ ...s, status: 'paused' }));
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      setState((s) => ({ ...s, status: 'recording' }));
    }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        cleanup();
        setState((s) => ({ ...s, status: 'stopped' }));
        resolve(blobRef.current);
        return;
      }
      mr.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        cleanup();
        setState((s) => ({ ...s, status: 'stopped' }));
        resolve(blobRef.current);
      };
      mr.stop();
    });
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    blobRef.current = null;
    setState({ status: 'idle', durationMs: 0, level: 0, error: null });
  }, [cleanup]);

  return { state, start, pause, resume, stop, reset };
}