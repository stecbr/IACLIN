import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, DollarSign, MoreHorizontal, ClipboardList,
  User, DoorOpen, Briefcase, Brain, Bot, CalendarClock, CalendarDays,
  ClipboardCheck, Building2, FolderHeart, Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { FileHeart, Settings } from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getMapForSpecialty } from '@/components/clinical-map/mapRegistry';
import { getFamilyConfig } from '@/lib/specialtyFamily';

export function MobileBottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { filterNavItems, effectiveRole } = useRoleAccess();
  const { clinicCategory, user, currentClinicId } = useAuth();
  const isDentist = effectiveRole === 'dentist';

  const { data: memberSpecialty } = useQuery({
    queryKey: ['mobile-member-specialty', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user?.id || !currentClinicId) return null;
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data?.specialty ?? null;
    },
    enabled: !!user?.id && !!currentClinicId && isDentist,
  });
  const dynamicMap = isDentist ? getMapForSpecialty(memberSpecialty) : null;
  const familyConfig = isDentist ? getFamilyConfig(memberSpecialty) : null;
  const isPsi = familyConfig?.family === 'psi';

  const allMainItems = isDentist
    ? [
        { title: 'Início', url: '/', icon: LayoutDashboard },
        { title: 'Agenda', url: '/agenda', icon: Calendar },
        { title: 'Pacientes', url: '/patients', icon: Users },
        { title: 'Perfil', url: '/perfil', icon: User },
      ]
    : [
        { title: 'Dashboard', url: '/', icon: LayoutDashboard },
        { title: 'Agenda', url: '/agenda', icon: Calendar },
        { title: 'Pacientes', url: '/patients', icon: Users },
        { title: 'Financeiro', url: '/financial', icon: DollarSign },
      ];

  const allMoreItems = isDentist
    ? [
        { title: 'Ferramentas', url: '/ferramentas', icon: isPsi ? Brain : Briefcase },
        ...(isPsi ? [] : [{ title: 'Orçamentos', url: '/budgets', icon: ClipboardList }]),
      ]
    : [
        { title: 'Sala de Espera', url: '/sala-de-espera', icon: DoorOpen },
        { title: 'Orçamentos', url: '/budgets', icon: ClipboardList },
        { title: 'Secretária IA', url: '/secretaria-ia', icon: Bot },
        { title: 'Configurações', url: '/settings', icon: Settings },
      ];

  const mainItems = filterNavItems(allMainItems);
  const moreItems = filterNavItems(
    allMoreItems.filter((item) => !('categories' in item) || item.categories.includes(clinicCategory))
  );

  const isActive = (url: string) => {
    if (url === '/') return location.pathname === '/';
    return location.pathname.startsWith(url);
  };

  const isMoreActive = moreItems.some((item) => isActive(item.url));

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="fixed bottom-[72px] left-4 right-4 max-h-[70vh] overflow-y-auto bg-popover border border-border rounded-xl shadow-lg p-2 animate-in" onClick={(e) => e.stopPropagation()}>
            {moreItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setShowMore(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.url) ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/80 backdrop-blur-lg safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {mainItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[56px] ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{item.title}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[56px] ${
              isMoreActive || showMore ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MoreHorizontal className={`h-5 w-5 ${isMoreActive ? 'stroke-[2.5]' : ''}`} />
            <span className={`text-[10px] ${isMoreActive ? 'font-semibold' : 'font-medium'}`}>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
