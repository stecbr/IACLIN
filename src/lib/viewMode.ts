export type ViewMode = 'manager' | 'consult';

const KEY = (userId: string, clinicId: string) => `iaclin.viewMode.${userId}.${clinicId}`;

export function getViewMode(userId: string | null | undefined, clinicId: string | null | undefined): ViewMode | null {
  if (!userId || !clinicId || typeof window === 'undefined') return null;
  const v = localStorage.getItem(KEY(userId, clinicId));
  return v === 'consult' || v === 'manager' ? v : null;
}

export function setViewMode(userId: string, clinicId: string, mode: ViewMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY(userId, clinicId), mode);
  // Notify same-tab listeners (storage event only fires on other tabs).
  window.dispatchEvent(new CustomEvent('iaclin:view-mode-changed', { detail: { userId, clinicId, mode } }));
}

export const VIEW_MODE_EVENT = 'iaclin:view-mode-changed';