import { useAuth } from '@/contexts/AuthContext';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import { getViewMode } from '@/lib/viewMode';
import { useEffect, useState } from 'react';
import { VIEW_MODE_EVENT } from '@/lib/viewMode';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import type { StaffPermissions } from '@/components/settings/StaffPermissionsDialog';

type AppRole = 'admin' | 'dentist' | 'secretary' | 'auxiliary' | 'patient' | 'operator';

interface RouteAccess {
  path: string;
  allowedRoles: AppRole[];
}

// Define which roles can access which routes
const routePermissions: RouteAccess[] = [
  { path: '/', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/agenda', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/minha-agenda', allowedRoles: ['admin', 'dentist'] },
  { path: '/disponibilidade', allowedRoles: ['admin', 'dentist'] },
  { path: '/sala-de-espera', allowedRoles: ['admin', 'secretary', 'auxiliary'] },
  { path: '/pacientes-do-dia', allowedRoles: ['admin', 'dentist'] },
  { path: '/patients', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/clinica', allowedRoles: ['admin'] },
  { path: '/clinica/medicos', allowedRoles: ['admin'] },
  { path: '/clinica/credenciamentos', allowedRoles: ['admin'] },
  { path: '/clinica/convenios', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/clinica/aprovacoes', allowedRoles: ['admin', 'secretary', 'auxiliary'] },
  { path: '/odontogram', allowedRoles: ['admin', 'dentist'] },
  { path: '/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/psi/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/estetica/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/medico/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/nutricao/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/fisio/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/podologia/ferramentas', allowedRoles: ['admin', 'dentist'] },
  { path: '/atendimento', allowedRoles: ['admin', 'dentist'] },
  { path: '/budgets', allowedRoles: ['admin', 'dentist'] },
  { path: '/financial', allowedRoles: ['admin', 'secretary', 'auxiliary'] },
  { path: '/secretaria-ia', allowedRoles: ['admin'] },
  { path: '/ia-gestor', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/chamados', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/settings', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/perfil', allowedRoles: ['admin', 'dentist', 'secretary', 'auxiliary'] },
  { path: '/paciente', allowedRoles: ['patient'] },
  { path: '/paciente/plano', allowedRoles: ['patient'] },
  { path: '/paciente/agendas', allowedRoles: ['patient'] },
  { path: '/paciente/agendar', allowedRoles: ['patient'] },
  { path: '/paciente/historico', allowedRoles: ['patient'] },
  { path: '/paciente/exames', allowedRoles: ['patient'] },
  { path: '/paciente/configuracoes', allowedRoles: ['patient'] },
];

export function useRoleAccess() {
  const { clinicRole, isPatient, simulatedRole, user, currentClinicId, isClinicOwner } = useAuth();
  const isClinicSignup = useIsClinicSignup();
  const { isStaff, permissions: staffPerms } = useStaffPermissions();

  // Dev simulation wins over everything when set
  // Patient role takes precedence; default to admin if no clinic role (owner / solo user)
  const normalizedClinicRole = (clinicRole as string) === 'owner' ? 'admin' : clinicRole;

  // React to view-mode changes (manager <-> consult) from the toggle.
  const [viewModeTick, setViewModeTick] = useState(0);
  useEffect(() => {
    const onChange = () => setViewModeTick((n) => n + 1);
    window.addEventListener(VIEW_MODE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(VIEW_MODE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const stored = getViewMode(user?.id, currentClinicId);
  // Default: admins/owners start in manager mode; dentists start in consult mode.
  const canSwitch = !!currentClinicId && (
    normalizedClinicRole === 'admin' || (normalizedClinicRole === 'dentist' && isClinicOwner)
  );
  const defaultMode = normalizedClinicRole === 'dentist' ? 'consult' : 'manager';
  const viewMode = canSwitch ? (stored ?? defaultMode) : null;

  // When the owner switches to "consult", show them the professional UI.
  // When a dentist-owner switches back to "manager", show them the admin UI.
  const roleAfterView: AppRole | null = (() => {
    if (!viewMode) return null;
    if (viewMode === 'consult') return 'dentist';
    if (viewMode === 'manager' && isClinicOwner) return 'admin';
    return null;
  })();

  const effectiveRole: AppRole = simulatedRole
    ? (simulatedRole as AppRole)
    : (isPatient
        ? 'patient'
        : (roleAfterView ?? ((normalizedClinicRole as AppRole) ?? 'admin')));
  // Touch the tick so eslint doesn't strip the effect dependency-free var.
  void viewModeTick;

  const canAccess = (path: string): boolean => {
    // Clinic signups don't have a personal "Meu Perfil" — redirect to /settings.
    if (isClinicSignup && path.startsWith('/perfil')) return false;
    if (isStaff && staffPerms) {
      const map: Array<[string, keyof StaffPermissions]> = [
        ['/agenda',                 'agenda'],
        ['/sala-de-espera',         'salaEspera'],
        ['/clinica/aprovacoes',     'aprovacoes'],
        ['/clinica/convenios',      'convenios'],
        ['/patients',               'pacientes'],
        ['/financial',              'financeiro'],
        ['/ia-gestor',              'iaGestor'],
        ['/secretaria-ia',          'secretariaIa'],
        ['/chamados',               'chamados'],
        ['/settings',               'settings'],
      ];
      for (const [prefix, key] of map) {
        if (path === prefix || path.startsWith(`${prefix}/`)) {
          if (staffPerms[key] === false) return false;
          break;
        }
      }
      if (path === '/' && staffPerms.dashboard === false) return false;
    }
    const rule = routePermissions.find((r) => {
      if (r.path === '/') return path === '/';
      return path.startsWith(r.path);
    });
    if (!rule) return true; // unknown routes are accessible
    return rule.allowedRoles.includes(effectiveRole);
  };

  const filterNavItems = <T extends { url: string }>(items: T[]): T[] => {
    return items.filter((item) => canAccess(item.url));
  };

  return { canAccess, filterNavItems, effectiveRole };
}
