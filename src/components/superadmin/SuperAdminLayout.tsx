import { ReactNode } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  HeartPulse,
  LogOut,
  Sun,
  Moon,
  ShieldCheck,
  Settings,
  Package,
  TicketPercent,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import iaclinLogoAsset from '@/assets/iaclin-logo.png.asset.json';
const logoLight = iaclinLogoAsset.url;
const logoDark = iaclinLogoAsset.url;
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ArrowRight } from 'lucide-react';
import { IaclinWordmark } from '@/components/IaclinWordmark';

const nav = [
  { to: '/superadmin',               label: 'Visão Geral',    icon: LayoutDashboard, end: true },
  { to: '/superadmin/clinicas',      label: 'Clínicas',       icon: Building2 },
  { to: '/superadmin/medicos',       label: 'Médicos',        icon: Stethoscope },
  { to: '/superadmin/operadoras',    label: 'Operadoras',     icon: HeartPulse },
  { to: '/superadmin/planos',        label: 'Planos',         icon: Package },
  { to: '/superadmin/cupons',        label: 'Cupons',         icon: TicketPercent },
  { to: '/superadmin/pagamentos',    label: 'Pagamentos',     icon: CreditCard },
  { to: '/superadmin/configuracoes', label: 'Configurações',  icon: Settings },
];

function SuperAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { resolved } = useTheme();
  const { signOut, user } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'SA';
  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={collapsed ? 'items-center p-2 bg-background border-b border-sidebar-border/60' : 'p-4 bg-background border-b border-sidebar-border/60'}>
        <div className={collapsed ? 'flex w-full items-center justify-center' : 'flex items-center gap-2'}>
          <img
            src={resolved === 'dark' ? logoDark : logoLight}
            alt="IACLIN"
            className={collapsed ? 'h-8 w-8 object-contain flex-shrink-0' : 'h-8 object-contain'}
          />
          {!collapsed && <IaclinWordmark size="md" />}
          {!collapsed && (
            <span className="text-[10px] font-bold text-primary border-l border-sidebar-border/60 pl-2 ml-1 uppercase tracking-wider">
              Super Admin
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={collapsed ? 'px-0' : 'px-2'}>
        <SidebarGroup className={collapsed ? 'p-2' : undefined}>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 mb-1 font-semibold">
              Plataforma
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? 'items-center' : undefined}>
              {nav.map((item) => {
                const active = isActive(item.to, item.end);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={`relative rounded-xl text-sm transition-all duration-200 ${
                        collapsed
                          ? 'mx-auto justify-center'
                          : 'gap-3 px-3 py-2.5 h-auto'
                      } ${
                        active
                          ? 'bg-gradient-to-r from-primary/12 to-primary/6 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:bg-gradient-to-r hover:from-primary/12 hover:to-primary/6 hover:text-primary'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                      }`}
                    >
                      <NavLink to={item.to} end={item.end}>
                        <item.icon
                          className={`h-4 w-4 flex-shrink-0 transition-colors ${active ? 'text-primary' : ''}`}
                        />
                        {!collapsed && <span className="flex-1">{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <TooltipProvider>
          {!collapsed ? (
            <div className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/40 hover:bg-sidebar-accent/30 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted-foreground/10 text-muted-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">Super Admin</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="p-2 rounded-md border border-sidebar-border/40 text-muted-foreground hover:bg-sidebar-accent/40 transition-colors"
                    aria-label="Sair"
                  >
                    <ArrowRight className="h-4 w-4" />
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

export function SuperAdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { resolved, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <div className="hidden md:block">
          <SuperAdminSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  Administração da Plataforma IACLIN
                </span>
              </div>
            </div>
            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname.split('/').slice(0, 3).join('/')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {children ?? <Outlet />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
