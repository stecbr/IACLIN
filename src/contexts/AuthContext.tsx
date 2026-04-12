import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'dentist' | 'secretary';

interface ClinicMembership {
  clinic_id: string;
  role: AppRole;
  is_owner: boolean;
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
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [clinicMembership, setClinicMembership] = useState<ClinicMembership | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchUserData = (userId: string) => {
      Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
        supabase.from('clinic_members').select('clinic_id, role, is_owner').eq('user_id', userId).limit(1).maybeSingle(),
      ]).then(([{ data: rolesData }, { data: profileData }, { data: memberData }]) => {
        if (!mounted) return;
        setRoles((rolesData ?? []).map(r => r.role as AppRole));
        setProfile(profileData);
        if (memberData) {
          setClinicMembership({
            clinic_id: memberData.clinic_id,
            role: memberData.role as AppRole,
            is_owner: memberData.is_owner,
          });
        } else {
          setClinicMembership(null);
        }
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
        setClinicMembership(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      roles,
      profile,
      currentClinicId: clinicMembership?.clinic_id ?? null,
      clinicRole: clinicMembership?.role ?? null,
      isClinicOwner: clinicMembership?.is_owner ?? false,
      signOut,
      hasRole,
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
