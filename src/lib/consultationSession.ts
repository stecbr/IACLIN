export interface ConsultationSession {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  startedAt: string; // ISO
  pausedAt: number | null;
  accumulatedPausedMs: number;
}

const KEY = 'active-consultation';
const EVENT = 'consultation-session-change';

function emit() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getSession(): ConsultationSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsultationSession;
  } catch {
    return null;
  }
}

export function setSession(session: ConsultationSession | null) {
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
  emit();
}

export function startSession(input: {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  startedAt?: string;
}) {
  const existing = getSession();
  if (existing && existing.appointmentId === input.appointmentId) {
    // keep startedAt stable; update patient name if missing
    if (!existing.patientName && input.patientName) {
      setSession({ ...existing, patientName: input.patientName });
    }
    return existing;
  }
  const session: ConsultationSession = {
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    patientName: input.patientName,
    startedAt: input.startedAt ?? new Date().toISOString(),
    pausedAt: null,
    accumulatedPausedMs: 0,
  };
  setSession(session);
  return session;
}

export function endSession(appointmentId?: string) {
  const cur = getSession();
  if (!cur) return;
  if (appointmentId && cur.appointmentId !== appointmentId) return;
  setSession(null);
}

export function pauseSession() {
  const cur = getSession();
  if (!cur || cur.pausedAt) return;
  setSession({ ...cur, pausedAt: Date.now() });
}

export function resumeSession() {
  const cur = getSession();
  if (!cur || !cur.pausedAt) return;
  const accumulated = cur.accumulatedPausedMs + (Date.now() - cur.pausedAt);
  setSession({ ...cur, pausedAt: null, accumulatedPausedMs: accumulated });
}

export function computeElapsedSeconds(session: ConsultationSession | null): number {
  if (!session) return 0;
  const started = new Date(session.startedAt).getTime();
  const now = Date.now();
  let pausedMs = session.accumulatedPausedMs;
  if (session.pausedAt) pausedMs += now - session.pausedAt;
  return Math.max(0, Math.floor((now - started - pausedMs) / 1000));
}

export function subscribeSession(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) cb();
  });
  return () => {
    window.removeEventListener(EVENT, handler);
  };
}