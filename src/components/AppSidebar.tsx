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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const { filterNavItems } = useRoleAccess();

  const filteredMainNav = filterNavItems(mainNav);
  const filteredClinicNav = filterNavItems(clinicNav);

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
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
            isActive(item.url)
              ? 'bg-gradient-to-r from-primary/12 to-primary/6 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
          }`}
          activeClassName=""
        >
          <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${isActive(item.url) ? 'text-primary' : ''}`} />
          {!collapsed && (
            <>
              <span className="flex-1">{item.title}</span>
              {badge !== undefined && badge > 0 && (
                <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground px-1.5">
                  {badge}
                  <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                </span>
              )}
            </>
          )}
          {collapsed && badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1">
              {badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
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
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
              Principal
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainNav.map((item) =>
                renderNavItem(item, item.url === '/agenda' ? todayCount : undefined)
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-3 my-2">
          <div className="h-px bg-sidebar-border/60" />
        </div>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
              Clínica
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredClinicNav.map((item) => renderNavItem(item))}
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
        <TooltipProvider>
          {!collapsed ? (
            <div className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-sidebar-accent/40 transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name ?? user?.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mx-auto"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
