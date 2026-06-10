import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isDevEmail, SimulatedRole, SIMULATED_ROLE_STORAGE_KEY } from '@/lib/devAccess';

type AppRole = 'admin' | 'dentist' | 'secretary' | 'patient' | 'operator';
type ClinicCategory = 'odonto' | 'medico' | 'estetica' | 'veterinario' | 'outro';

/** E-mail do administrador geral da plataforma IACLIN */
const PLATFORM_ADMIN_EMAIL = 'iaclin@gmail.com';

interface ClinicMembership {
  clinic_id: string;
  clinic_name: string;
  role: AppRole;
  is_owner: boolean;
  category: ClinicCategory;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  profile: { full_name: string | null; avatar_url: string | null } | null;
  currentClinicId: string | null;
  clinicRole: AppRole | null;
  isClinicOwner: boolean;
  clinicCategory: ClinicCategory;
  isPatient: boolean;
  isOperator: boolean;
  isPlatformAdmin: boolean;
  operatorId: string | null;
  isPersonalMode: boolean;
  clinics: ClinicMembership[];
  clinicsLoaded: boolean;
  switchClinic: (clinicId: string) => void;
  switchToPersonal: () => void;
  refreshClinics: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isDevUser: boolean;
  simulatedRole: SimulatedRole | null;
  setSimulatedRole: (role: SimulatedRole | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_CLINIC_STORAGE_KEY = 'iaclin.currentClinicId';
const LEGACY_SCOPE_STORAGE_KEY = 'iaclin.scope';
const clinicStorageKey = (userId: string) => `iaclin.currentClinicId.${userId}`;
const scopeStorageKey = (userId: string) => `iaclin.scope.${userId}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);
  const [currentClinicId, setCurrentClinicId] = useState<string | null>(null);
  const [clinicsLoaded, setClinicsLoaded] = useState(false);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [personalScope, setPersonalScope] = useState(false);
  // Modo de simulação foi descontinuado. Limpa qualquer valor antigo do
  // localStorage e mantém o estado sempre nulo.
  const [simulatedRole, setSimulatedRoleState] = useState<SimulatedRole | null>(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;
    let lastUserId: string | null = null;

    const fetchUserData = (userId: string) => {
      Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
        supabase.from('clinic_members').select('clinic_id, role, is_owner').eq('user_id', userId),
        supabase.from('operator_members').select('operator_id').eq('user_id', userId).maybeSingle(),
      ]).then(async ([{ data: rolesData }, { data: profileData }, { data: memberData }, { data: operatorMember }]) => {
        if (!mounted) return;
        setRoles((rolesData ?? []).map(r => r.role as AppRole));
        setProfile(profileData);
        setOperatorId((operatorMember as any)?.operator_id ?? null);
        const memberRows = (memberData ?? []) as Array<{ clinic_id: string; role: string; is_owner: boolean }>;
        const storedPersonalScope = typeof window !== 'undefined'
          ? localStorage.getItem(scopeStorageKey(userId)) === 'personal'
          : false;
        setPersonalScope(storedPersonalScope);
        if (memberRows.length === 0) {
          setClinics([]);
          setCurrentClinicId(null);
          setClinicsLoaded(true);
          return;
        }
        const clinicIds = memberRows.map((m) => m.clinic_id);
        const { data: clinicsData } = await supabase
          .from('clinics')
          .select('id, name, category')
          .in('id', clinicIds);
        const clinicMap = new Map((clinicsData ?? []).map((c) => [c.id, c]));
        const memberships: ClinicMembership[] = memberRows.map((m) => ({
          clinic_id: m.clinic_id,
          clinic_name: clinicMap.get(m.clinic_id)?.name ?? 'Clínica',
          role: m.role as AppRole,
          is_owner: m.is_owner,
          category: (clinicMap.get(m.clinic_id)?.category ?? 'odonto') as ClinicCategory,
        }));
        if (!mounted) return;
        setClinics(memberships);

        // Pick current clinic per authenticated user. Prefer the user's own
        // clinic when there is no user-scoped selection to avoid showing a
        // clinic remembered from another login in the same browser.
        const stored = typeof window !== 'undefined' ? localStorage.getItem(clinicStorageKey(userId)) : null;
        const validStored = stored && memberships.some((m) => m.clinic_id === stored) ? stored : null;
        const ownedClinic = memberships.find((m) => m.is_owner || m.role === 'admin');
        setCurrentClinicId(validStored ?? ownedClinic?.clinic_id ?? memberships[0].clinic_id);
        setClinicsLoaded(true);
      });
    };

    // expose for refresh
    (globalThis as any).__iaclinFetchUserData = fetchUserData;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        lastUserId = session.user.id;
        fetchUserData(session.user.id);
      } else {
        setClinicsLoaded(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Only re-fetch user-scoped data when the user actually changes.
        // Otherwise events like TOKEN_REFRESHED / INITIAL_SESSION cause a
        // re-fetch loop that re-mounts the patient area every few seconds.
        if (lastUserId !== session.user.id) {
          lastUserId = session.user.id;
          setClinicsLoaded(false);
          fetchUserData(session.user.id);
        }
      } else {
        lastUserId = null;
        setRoles([]);
        setProfile(null);
        setClinics([]);
        setCurrentClinicId(null);
        setClinicsLoaded(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      delete (globalThis as any).__iaclinFetchUserData;
    };
  }, []);

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
      if (user?.id) {
        localStorage.removeItem(clinicStorageKey(user.id));
        localStorage.removeItem(scopeStorageKey(user.id));
      }
      localStorage.removeItem(LEGACY_CLINIC_STORAGE_KEY);
      localStorage.removeItem(LEGACY_SCOPE_STORAGE_KEY);
    }
    setSimulatedRoleState(null);
    await supabase.auth.signOut();
  };

  const refreshClinics = async () => {
    if (!user?.id) return;
    const fn = (globalThis as any).__iaclinFetchUserData as ((id: string) => void) | undefined;
    if (fn) fn(user.id);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isPatient = roles.includes('patient');
  const isOperator = roles.includes('operator');
  const switchClinic = (clinicId: string) => {
    if (!clinics.some((c) => c.clinic_id === clinicId)) return;
    setCurrentClinicId(clinicId);
    setPersonalScope(false);
    if (typeof window !== 'undefined' && user?.id) localStorage.setItem(clinicStorageKey(user.id), clinicId);
    if (typeof window !== 'undefined' && user?.id) localStorage.removeItem(scopeStorageKey(user.id));
  };
  const switchToPersonal = () => {
    setPersonalScope(true);
    if (typeof window !== 'undefined' && user?.id) localStorage.setItem(scopeStorageKey(user.id), 'personal');
  };
  const currentMembership = clinics.find((c) => c.clinic_id === currentClinicId) ?? null;
  // Dentists with no clinics fall back to personal mode automatically so
  // they can use the app while choosing whether to register a clinic or
  // join an existing one via invite code from the sidebar.
  const isPersonalMode =
    roles.includes('dentist') && (personalScope || clinics.length === 0);

  const isPlatformAdmin = user?.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
  const isDevUser = isDevEmail(user?.email);
  // Setter mantido por compatibilidade, mas é no-op (modo simulação removido).
  const setSimulatedRole = (_role: SimulatedRole | null) => {
    setSimulatedRoleState(null);
    if (typeof window !== 'undefined') localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
  };
  const effectiveSimulatedRole = null;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      roles,
      profile,
      currentClinicId: isPersonalMode ? null : currentClinicId,
      clinicRole: currentMembership?.role ?? null,
      isClinicOwner: currentMembership?.is_owner ?? false,
      clinicCategory: currentMembership?.category ?? 'odonto',
      isPatient,
      isOperator,
      isPlatformAdmin,
      operatorId,
      isPersonalMode,
      clinics,
      clinicsLoaded,
      switchClinic,
      switchToPersonal,
      refreshClinics,
      signOut,
      hasRole,
      isDevUser,
      simulatedRole: effectiveSimulatedRole,
      setSimulatedRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
