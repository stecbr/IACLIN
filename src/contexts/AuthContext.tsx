import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isDevEmail, SimulatedRole, SIMULATED_ROLE_STORAGE_KEY } from '@/lib/devAccess';

type AppRole = 'admin' | 'dentist' | 'secretary' | 'patient';
type ClinicCategory = 'odonto' | 'medico' | 'estetica' | 'veterinario' | 'outro';

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
  isPersonalMode: boolean;
  clinics: ClinicMembership[];
  switchClinic: (clinicId: string) => void;
  switchToPersonal: () => void;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isDevUser: boolean;
  simulatedRole: SimulatedRole | null;
  setSimulatedRole: (role: SimulatedRole | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CLINIC_STORAGE_KEY = 'iaclin.currentClinicId';
const SCOPE_STORAGE_KEY = 'iaclin.scope'; // 'personal' or absent

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);
  const [currentClinicId, setCurrentClinicId] = useState<string | null>(null);
  const [personalScope, setPersonalScope] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SCOPE_STORAGE_KEY) === 'personal';
  });
  const [simulatedRole, setSimulatedRoleState] = useState<SimulatedRole | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(SIMULATED_ROLE_STORAGE_KEY);
    if (stored === 'admin' || stored === 'dentist' || stored === 'patient') return stored;
    return null;
  });

  useEffect(() => {
    let mounted = true;

    const fetchUserData = (userId: string) => {
      Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
        supabase.from('clinic_members').select('clinic_id, role, is_owner').eq('user_id', userId),
      ]).then(async ([{ data: rolesData }, { data: profileData }, { data: memberData }]) => {
        if (!mounted) return;
        setRoles((rolesData ?? []).map(r => r.role as AppRole));
        setProfile(profileData);
        const memberRows = (memberData ?? []) as Array<{ clinic_id: string; role: string; is_owner: boolean }>;
        if (memberRows.length === 0) {
          setClinics([]);
          setCurrentClinicId(null);
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

        // Pick current clinic: stored value if still valid, otherwise first
        const stored = typeof window !== 'undefined' ? localStorage.getItem(CLINIC_STORAGE_KEY) : null;
        const validStored = stored && memberships.some((m) => m.clinic_id === stored) ? stored : null;
        setCurrentClinicId(validStored ?? memberships[0].clinic_id);
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setRoles([]);
        setProfile(null);
        setClinics([]);
        setCurrentClinicId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
    setSimulatedRoleState(null);
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isPatient = roles.includes('patient');
  const switchClinic = (clinicId: string) => {
    if (!clinics.some((c) => c.clinic_id === clinicId)) return;
    setCurrentClinicId(clinicId);
    setPersonalScope(false);
    if (typeof window !== 'undefined') localStorage.setItem(CLINIC_STORAGE_KEY, clinicId);
    if (typeof window !== 'undefined') localStorage.removeItem(SCOPE_STORAGE_KEY);
  };
  const switchToPersonal = () => {
    setPersonalScope(true);
    if (typeof window !== 'undefined') localStorage.setItem(SCOPE_STORAGE_KEY, 'personal');
  };
  const currentMembership = clinics.find((c) => c.clinic_id === currentClinicId) ?? null;
  const isPersonalMode = personalScope && roles.includes('dentist');

  const isDevUser = isDevEmail(user?.email);
  const setSimulatedRole = (role: SimulatedRole | null) => {
    if (!isDevUser) return; // hard guard
    setSimulatedRoleState(role);
    if (typeof window === 'undefined') return;
    if (role === null) localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
    else localStorage.setItem(SIMULATED_ROLE_STORAGE_KEY, role);
  };
  // Effective simulated role: only honored if user is whitelisted
  const effectiveSimulatedRole = isDevUser ? simulatedRole : null;

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
      isPersonalMode,
      clinics,
      switchClinic,
      switchToPersonal,
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
