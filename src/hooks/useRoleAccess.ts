import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'dentist' | 'secretary';

interface RouteAccess {
  path: string;
  allowedRoles: AppRole[];
}

// Define which roles can access which routes
const routePermissions: RouteAccess[] = [
  { path: '/', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/agenda', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/patients', allowedRoles: ['admin', 'dentist', 'secretary'] },
  { path: '/odontogram', allowedRoles: ['admin', 'dentist'] },
  { path: '/financial', allowedRoles: ['admin', 'secretary'] },
  { path: '/settings', allowedRoles: ['admin', 'dentist', 'secretary'] },
];

export function useRoleAccess() {
  const { clinicRole } = useAuth();
  
  // Default to admin if no clinic role (owner / solo user)
  const effectiveRole: AppRole = clinicRole ?? 'admin';

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
