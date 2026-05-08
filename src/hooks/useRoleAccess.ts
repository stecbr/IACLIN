import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'dentist' | 'secretary' | 'patient';

interface RouteAccess {
  path: string;
  allowedRoles: AppRole[];
}

// Define which roles can access which routes
const routePermissions: RouteAccess[] = [
  { path: '/', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/agenda', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/disponibilidade', allowedRoles: ['admin', 'dentist'] },
  { path: '/sala-de-espera', allowedRoles: ['admin', 'secretary'] },
  { path: '/pacientes-do-dia', allowedRoles: ['admin', 'dentist'] },
  { path: '/patients', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/clinica', allowedRoles: ['admin'] },
  { path: '/clinica/medicos', allowedRoles: ['admin'] },
  { path: '/clinica/aprovacoes', allowedRoles: ['admin', 'secretary'] },
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
  { path: '/financial', allowedRoles: ['admin', 'secretary'] },
  { path: '/secretaria-ia', allowedRoles: ['admin'] },
  { path: '/settings', allowedRoles: ['admin', 'secretary'] },
  { path: '/perfil', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/paciente', allowedRoles: ['patient'] },
  { path: '/paciente/plano', allowedRoles: ['patient'] },
  { path: '/paciente/agendas', allowedRoles: ['patient'] },
  { path: '/paciente/agendar', allowedRoles: ['patient'] },
  { path: '/paciente/historico', allowedRoles: ['patient'] },
  { path: '/paciente/exames', allowedRoles: ['patient'] },
  { path: '/paciente/configuracoes', allowedRoles: ['patient'] },
];

export function useRoleAccess() {
  const { clinicRole, isPatient, simulatedRole } = useAuth();

  // Dev simulation wins over everything when set
  // Patient role takes precedence; default to admin if no clinic role (owner / solo user)
  const effectiveRole: AppRole = simulatedRole
    ? (simulatedRole as AppRole)
    : (isPatient ? 'patient' : (clinicRole ?? 'admin'));

  const canAccess = (path: string): boolean => {
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
