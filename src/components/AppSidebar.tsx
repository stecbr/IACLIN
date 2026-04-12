import {
  LayoutDashboard,
  Calendar,
  Users,
  FileHeart,
  DollarSign,
  Settings,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const mainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Agenda', url: '/agenda', icon: Calendar },
];

const clinicNav = [
  { title: 'Pacientes', url: '/patients', icon: Users },
  { title: 'Odontograma', url: '/odontogram', icon: FileHeart },
  { title: 'Financeiro', url: '/financial', icon: DollarSign },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, signOut, user } = useAuth();

  // Today's appointment count for badge
  const { data: todayCount = 0 } = useQuery({
    queryKey: ['today-apt-count'],
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', start)
        .lt('start_time', end);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const isActive = (url: string) => {
    if (url === '/') return location.pathname === '/';
    return location.pathname.startsWith(url);
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'U';

  const renderNavItem = (item: typeof mainNav[0], badge?: number) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
      >
        <NavLink
          to={item.url}
          end={item.url === '/'}
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-sidebar-accent ${
            isActive(item.url)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-primary'
              : 'text-sidebar-foreground'
          }`}
          activeClassName=""
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.title}</span>
              {badge !== undefined && badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground px-1.5">
                  {badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-foreground">IA</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-semibold text-foreground truncate">IACLIN</span>
              <span className="text-[10px] text-muted-foreground truncate">Gestão Odontológica</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) =>
                renderNavItem(item, item.url === '/agenda' ? todayCount : undefined)
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 mb-1 mt-2">Clínica</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {clinicNav.map((item) => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="flex-1" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem({ title: 'Configurações', url: '/settings', icon: Settings })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name ?? user?.email}
              </p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors mx-auto"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
