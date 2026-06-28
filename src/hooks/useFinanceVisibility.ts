import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSoloMode } from '@/hooks/useSoloMode';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { canManageClinicFinance } from '@/lib/financePermissions';

export type FinanceMode = 'solo' | 'clinic' | 'professional' | 'staff' | 'denied';

export interface FinanceVisibility {
  mode: FinanceMode;
  canSeeClinicCash: boolean;
  canSeeOperationalExpenses: boolean;
  canSeePayouts: boolean;
  canManagePayments: boolean;
  canSeeOwnCommissions: boolean;
}

/**
 * Single source of truth for who can see what inside the financial module.
 * Combines: solo detection, RBAC effective role, ownership and staff perms.
 */
export function useFinanceVisibility(): FinanceVisibility {
  const { currentClinicId, isClinicOwner } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const { isSolo } = useSoloMode();
  const { isStaff, permissions: staffPerms } = useStaffPermissions();

  const hasClinic = !!currentClinicId;

  // Staff with finance turned off → no access at all (route also blocks).
  if (isStaff && staffPerms && staffPerms.financeiro === false) {
    return {
      mode: 'denied',
      canSeeClinicCash: false,
      canSeeOperationalExpenses: false,
      canSeePayouts: false,
      canManagePayments: false,
      canSeeOwnCommissions: false,
    };
  }

  // Solo: owner that is also the only member.
  if (isSolo) {
    return {
      mode: 'solo',
      canSeeClinicCash: true,
      canSeeOperationalExpenses: true,
      canSeePayouts: false, // no third parties to pay out
      canManagePayments: true,
      canSeeOwnCommissions: false,
    };
  }

  // Linked professional (dentist who is NOT the clinic owner).
  if (effectiveRole === 'dentist' && !isClinicOwner) {
    return {
      mode: 'professional',
      canSeeClinicCash: false,
      canSeeOperationalExpenses: false,
      canSeePayouts: false,
      canManagePayments: false,
      canSeeOwnCommissions: true,
    };
  }

  // Staff (secretary/auxiliary) with finance permission.
  if (isStaff) {
    return {
      mode: 'staff',
      canSeeClinicCash: true,
      canSeeOperationalExpenses: true,
      canSeePayouts: true,
      canManagePayments: canManageClinicFinance({
        isSolo: false,
        role: effectiveRole as any,
        hasClinic,
      }),
      canSeeOwnCommissions: false,
    };
  }

  // Default: admin/owner of a multi-member clinic (or admin in personal/clinic mode).
  return {
    mode: 'clinic',
    canSeeClinicCash: true,
    canSeeOperationalExpenses: true,
    canSeePayouts: true,
    canManagePayments: canManageClinicFinance({
      isSolo: false,
      role: effectiveRole as any,
      hasClinic,
    }),
    canSeeOwnCommissions: false,
  };
}