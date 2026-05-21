import type { useSoloMode } from '@/hooks/useSoloMode';

type Role = 'admin' | 'dentist' | 'secretary' | 'patient' | 'operator';

/**
 * True when the current user can directly create/approve financial charges
 * on behalf of the clinic. Dentists in a multi-member clinic must request
 * approval from a secretary or admin.
 */
export function canManageClinicFinance(params: {
  isSolo: boolean;
  role: Role;
  hasClinic: boolean;
}) {
  if (!params.hasClinic) return true; // personal mode
  if (params.isSolo) return true;
  return params.role === 'admin' || params.role === 'secretary';
}

export type SoloModeResult = ReturnType<typeof useSoloMode>;