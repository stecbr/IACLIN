import {
  LayoutDashboard,
  CreditCard,
  Calendar,
  CalendarPlus,
  FileText,
  History,
  Settings,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  { title: 'Dashboard', url: '/paciente', icon: LayoutDashboard, end: true },
  { title: 'Agendar consulta', url: '/paciente/agendar', icon: CalendarPlus },
  { title: 'Minhas Consultas', url: '/paciente/agendas', icon: Calendar },
  { title: 'Histórico', url: '/paciente/historico', icon: History },
  { title: 'Meus Exames', url: '/paciente/exames', icon: FileText },
  { title: 'Plano de Saúde', url: '/paciente/plano', icon: CreditCard },
];

const accountNav = [
  { title: 'Configurações', url: '/paciente/configuracoes', icon: Settings },
];

export function PatientSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { resolved } = useTheme();
  const { profile, signOut, user } = useAuth();

  const isActive = (url: string, end?: boolean) => {
    if (end) return location.pathname === url;
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? 'P';

  const renderNavItem = (item: typeof mainNav[0]) => {
    const active = isActive(item.url, item.end);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <NavLink
            to={item.url}
            end={item.end}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              active
                ? 'bg-gradient-to-r from-primary/12 to-primary/6 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
            }`}
            activeClassName=""
          >
            <item.icon
              className={`h-4 w-4 flex-shrink-0 transition-colors ${active ? 'text-primary' : ''}`}
            />
            {!collapsed && <span className="flex-1">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {collapsed ? (
            <img
              src={resolved === 'dark' ? logoDark : logoLight}
              alt="IACLIN"
              className="h-8 w-8 object-contain flex-shrink-0"
            />
          ) : (
            <img
              src={resolved === 'dark' ? logoDark : logoLight}
              alt="IACLIN"
              className="h-8 object-contain"
            />
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
            <SidebarMenu>{mainNav.map((item) => renderNavItem(item))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-3 my-2">
          <div className="h-px bg-sidebar-border/60" />
        </div>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
              Conta
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{accountNav.map((item) => renderNavItem(item))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <TooltipProvider>
          {!collapsed ? (
            <div className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-sidebar-accent/40 transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name ?? user?.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
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
