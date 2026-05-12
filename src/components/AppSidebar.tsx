import {
  LayoutDashboard,
  Calendar,
  Users,
  FileHeart,
  DollarSign,
  ClipboardList,
  Settings,
  LogOut,
  Bot,
  CalendarClock,
  Building2,
  Stethoscope,
  Wallet,
  User as UserIcon,
  ClipboardCheck,
  DoorOpen,
  Briefcase,
  CalendarDays,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { useClinicBranding } from '@/hooks/useClinicBranding';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ClinicSwitcher } from '@/components/ClinicSwitcher';
import { useState } from 'react';
import { useActiveConsultation } from '@/hooks/useActiveConsultation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { getMapForSpecialty } from '@/components/clinical-map/mapRegistry';
import { getFamilyConfig } from '@/lib/specialtyFamily';
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

type Role = 'admin' | 'dentist' | 'secretary' | 'patient';
const ALL_CATEGORIES = ['odonto', 'medico', 'estetica', 'outro'];

// "Pessoal" — items vinculados ao profissional (não dependem de clínica ativa)
const personalNav: Array<{ title: string; url: string; icon: typeof LayoutDashboard; allowedRoles: Role[] }> = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, allowedRoles: ['admin', 'dentist', 'secretary'] },
  { title: 'Minha Agenda', url: '/agenda', icon: Calendar, allowedRoles: ['dentist'] },
  { title: 'Disponibilidade', url: '/disponibilidade', icon: CalendarClock, allowedRoles: ['dentist'] },
];

// "Operação" — itens da clínica ativa (agenda compartilhada, sala de espera, etc.)
const operationNav: Array<{ title: string; url: string; icon: typeof LayoutDashboard; allowedRoles: Role[] }> = [
  { title: 'Agenda', url: '/agenda', icon: Calendar, allowedRoles: ['admin', 'secretary'] },
  { title: 'Sala de Espera', url: '/sala-de-espera', icon: DoorOpen, allowedRoles: ['admin', 'secretary'] },
  { title: 'Disponibilidade', url: '/disponibilidade', icon: CalendarClock, allowedRoles: ['admin'] },
];

const clinicNav: Array<{ title: string; url: string; icon: typeof Users; categories: string[]; allowedRoles: Role[] }> = [
  { title: 'Pacientes do Dia', url: '/pacientes-do-dia', icon: CalendarDays, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Pacientes', url: '/patients', icon: Users, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist', 'secretary'] },
  { title: 'Aprovações', url: '/clinica/aprovacoes', icon: ClipboardCheck, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'secretary'] },
  { title: 'Odontograma', url: '/odontogram', icon: FileHeart, categories: ['odonto'], allowedRoles: ['admin', 'dentist'] },
  { title: 'Ferramentas Clínicas', url: '/ferramentas', icon: Briefcase, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Financeiro', url: '/financial', icon: DollarSign, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'secretary'] },
  { title: 'Orçamentos', url: '/budgets', icon: ClipboardList, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Secretária IA', url: '/secretaria-ia', icon: Bot, categories: ALL_CATEGORIES, allowedRoles: ['admin'] },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { resolved } = useTheme();
  const { logoUrl, hideIaclinLogo } = useClinicBranding();
  const { profile, signOut, user, clinicCategory } = useAuth();
  const { filterNavItems, effectiveRole } = useRoleAccess();
  const { simulatedRole, currentClinicId } = useAuth();
  const isDentist = effectiveRole === 'dentist';
  const activeConsultation = useActiveConsultation();
  const navigate = useNavigate();
  const [logoutBlocked, setLogoutBlocked] = useState(false);

  const handleSignOut = () => {
    if (activeConsultation) {
      setLogoutBlocked(true);
      return;
    }
    signOut();
  };

  // Doctor's specialty for dynamic clinical map item
  const { data: memberSpecialty } = useQuery({
    queryKey: ['member-specialty', user?.id, currentClinicId],
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
  const isOdonto = familyConfig?.family === 'odonto';
  // Pick the right Tools route per specialty family
  const toolsUrl = familyConfig?.toolsRoute ?? '/ferramentas';

  // Defense in depth: gate by allowedRoles AND by route permission
  const filteredPersonalNav = filterNavItems(
    personalNav.filter((item) => item.allowedRoles.includes(effectiveRole))
  );
  const filteredOperationNav = filterNavItems(
    operationNav.filter((item) => item.allowedRoles.includes(effectiveRole))
  );
  const filteredClinicNav = filterNavItems(
    clinicNav
      .filter(
        (item) =>
          item.categories.includes(clinicCategory) &&
          item.allowedRoles.includes(effectiveRole)
      )
      // For dentists: hide the static "Odontograma" item; we'll inject the dynamic map item below
      .filter((item) => !(isDentist && item.url === '/odontogram'))
      // Odontograma só faz sentido para a família odonto
      .filter((item) => !(item.url === '/odontogram' && !isOdonto))
      // Psicólogos não usam orçamentos — só sessões
      .filter((item) => !(isPsi && item.url === '/budgets'))
      // Rewrite the generic Tools URL based on the doctor's specialty
      .map((item) =>
        item.url === '/ferramentas' && toolsUrl !== '/ferramentas'
          ? { ...item, url: toolsUrl }
          : item,
      )
  );

  // Inject dynamic map item for dentists with a known specialty
  let finalClinicNav = isDentist && dynamicMap
    ? [
        ...filteredClinicNav.slice(0, 2),
        { title: dynamicMap.label, url: '/mapa-clinico', icon: dynamicMap.icon, categories: ALL_CATEGORIES, allowedRoles: ['dentist'] as Role[] },
        ...filteredClinicNav.slice(2),
      ]
    : filteredClinicNav;

  // (Tools are now unified at /ferramentas — no extra entry needed for psi)

  // Today's appointment count for badge
  const { data: todayCount = 0 } = useQuery({
    queryKey: ['today-apt-count', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId!)
        .gte('start_time', start)
        .lt('start_time', end)
        .not('status', 'in', '(cancelled)');
      return count ?? 0;
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // Pending appointment requests count for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-requests-count', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { count } = await supabase
        .from('appointment_requests')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId!)
        .eq('status', 'pending');
      return count ?? 0;
    },
    refetchInterval: 30000,
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

  const renderNavItem = (
    item: { title: string; url: string; icon: typeof LayoutDashboard },
    badge?: number,
  ) => (
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
          {(() => {
            const iaclinSrc = resolved === 'dark' ? logoDark : logoLight;
            const showIaclin = !(hideIaclinLogo && logoUrl);
            const showClinic = !!logoUrl;
            const sizeClass = collapsed ? 'h-8 w-8 object-contain flex-shrink-0' : 'h-8 object-contain';
            return (
              <div className="flex items-center gap-2">
                {showIaclin && <img src={iaclinSrc} alt="IACLIN" className={sizeClass} />}
                {showIaclin && showClinic && !collapsed && (
                  <span className="text-muted-foreground/40 text-sm">·</span>
                )}
                {showClinic && <img src={logoUrl!} alt="Logo da clínica" className={collapsed ? 'h-8 w-8 object-contain flex-shrink-0' : 'h-8 object-contain'} />}
              </div>
            );
          })()}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {filteredPersonalNav.length > 0 && (
          <>
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
                  Pessoal
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredPersonalNav.map((item) =>
                    renderNavItem(item, item.url === '/agenda' ? todayCount : undefined)
                  )}
                  {effectiveRole !== 'patient' && renderNavItem({ title: 'Meu Perfil', url: '/perfil', icon: UserIcon })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <div className="mx-3 my-2">
              <div className="h-px bg-sidebar-border/60" />
            </div>
          </>
        )}

        {/* Workspace switcher: separates personal data from clinic data */}
        <div className="px-2 pb-2">
          <ClinicSwitcher />
        </div>

        {filteredOperationNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
                Operação
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredOperationNav.map((item) =>
                  renderNavItem(item, item.url === '/agenda' ? todayCount : undefined)
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {currentClinicId && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
                Clínica
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {finalClinicNav.map((item) =>
                renderNavItem(
                  item,
                  item.url === '/clinica/aprovacoes'
                    ? pendingCount
                    : item.url === '/pacientes-do-dia'
                    ? todayCount
                    : undefined,
                )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isDentist && effectiveRole !== 'patient' && (
          <>
            <div className="mx-3 my-2">
              <div className="h-px bg-sidebar-border/60" />
            </div>
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 mb-1 font-semibold">
                  Gestão da Clínica
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItem({ title: 'Visão Geral', url: '/clinica', icon: Building2 })}
                  {renderNavItem({ title: 'Médicos', url: '/clinica/medicos', icon: Stethoscope })}
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled tooltip="Faturamento (em breve)">
                      <div className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/50 cursor-not-allowed w-full">
                        <Wallet className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">Faturamento</span>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                              em breve
                            </span>
                          </>
                        )}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <div className="flex-1" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isDentist && renderNavItem({ title: 'Configurações', url: '/settings', icon: Settings })}
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
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.full_name ?? user?.email}
                  </p>
                  {simulatedRole && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex-shrink-0">
                      Simulando
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
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
                  onClick={handleSignOut}
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
      <AlertDialog open={logoutBlocked} onOpenChange={setLogoutBlocked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você está em atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              Conclua a consulta atual antes de sair do sistema. Você pode voltar para o atendimento e finalizá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLogoutBlocked(false);
                if (activeConsultation) navigate(`/atendimento/${activeConsultation.appointmentId}`);
              }}
            >
              Voltar ao atendimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
