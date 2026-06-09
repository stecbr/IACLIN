import {
  LayoutDashboard,
  Calendar,
  Users,
  FileHeart,
  DollarSign,
  ClipboardList,
  Settings,
  LogOut,
  ArrowRight,
  Bot,
  Brain,
  CalendarClock,
  Building2,
  Stethoscope,
  Wallet,
  User as UserIcon,
  ClipboardCheck,
  DoorOpen,
  Briefcase,
  CalendarDays,
  FolderHeart,
  ChevronDown,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
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

type Role = 'admin' | 'dentist' | 'secretary' | 'patient' | 'operator';
const ALL_CATEGORIES = ['odonto', 'medico', 'estetica', 'outro'];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  dentist: 'Médico',
  secretary: 'Secretária',
  owner: 'Proprietário',
  operator: 'Operadora',
  patient: 'Paciente',
};

const ROLE_COLOR: Record<string, { ring: string; badge: string; dot: string }> = {
  admin:     { ring: 'ring-violet-500',   badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30',   dot: 'bg-violet-500' },
  dentist:   { ring: 'ring-blue-500',     badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30',           dot: 'bg-blue-500' },
  secretary: { ring: 'ring-teal-500',     badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-teal-500/30',           dot: 'bg-teal-500' },
  owner:     { ring: 'ring-indigo-500',   badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',   dot: 'bg-indigo-500' },
  operator:  { ring: 'ring-orange-500',   badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30',   dot: 'bg-orange-500' },
  patient:   { ring: 'ring-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30', dot: 'bg-emerald-500' },
};

// ─── Nav definitions ─────────────────────────────────────────────────────────

const personalNav: Array<{ title: string; url: string; icon: typeof LayoutDashboard; allowedRoles: Role[] }> = [
  { title: 'Dashboard',       url: '/',              icon: LayoutDashboard, allowedRoles: ['admin', 'dentist', 'secretary'] },
  { title: 'Minha Agenda',    url: '/minha-agenda',  icon: Calendar,        allowedRoles: ['admin', 'dentist'] },
  { title: 'Disponibilidade', url: '/disponibilidade', icon: CalendarClock, allowedRoles: ['admin', 'dentist'] },
];

const operationNav: Array<{ title: string; url: string; icon: typeof LayoutDashboard; allowedRoles: Role[] }> = [
  { title: 'Agenda',        url: '/agenda',        icon: Calendar,  allowedRoles: ['admin', 'secretary'] },
  { title: 'Sala de Espera', url: '/sala-de-espera', icon: DoorOpen, allowedRoles: ['admin', 'secretary'] },
];

const clinicNav: Array<{ title: string; url: string; icon: typeof Users; categories: string[]; allowedRoles: Role[] }> = [
  { title: 'Pacientes do Dia',  url: '/pacientes-do-dia',   icon: CalendarDays,   categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Pacientes',         url: '/patients',            icon: Users,          categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist', 'secretary'] },
  { title: 'Aprovações',        url: '/clinica/aprovacoes',  icon: ClipboardCheck, categories: ALL_CATEGORIES, allowedRoles: ['admin', 'secretary'] },
  { title: 'Credenciamentos',   url: '/clinica/credenciamentos', icon: Building2,  categories: ALL_CATEGORIES, allowedRoles: ['admin'] },
  { title: 'Odontograma',       url: '/odontogram',          icon: FileHeart,      categories: ['odonto'],      allowedRoles: ['admin', 'dentist'] },
  { title: 'Ferramentas Clínicas', url: '/ferramentas',      icon: Briefcase,      categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Financeiro',        url: '/financial',           icon: DollarSign,     categories: ALL_CATEGORIES, allowedRoles: ['admin', 'secretary'] },
  { title: 'Orçamentos',        url: '/budgets',             icon: ClipboardList,  categories: ALL_CATEGORIES, allowedRoles: ['admin', 'dentist'] },
  { title: 'Secretária IA',     url: '/secretaria-ia',       icon: Bot,            categories: ALL_CATEGORIES, allowedRoles: ['admin'] },
];

// ─── Collapsible group with localStorage persistence ─────────────────────────

function NavSection({
  id, label, collapsed, defaultOpen = true, children,
}: {
  id: string;
  label: string;
  collapsed: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(`sb-grp-${id}`);
      return v !== null ? v === '1' : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`sb-grp-${id}`, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  return (
    <SidebarGroup className="py-0">
      {!collapsed && (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center w-full px-3 py-1.5 mb-0.5 rounded-md hover:bg-sidebar-accent/30 transition-colors"
        >
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55 text-left">
            {label}
          </span>
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          />
        </button>
      )}
      {(collapsed || open) && (
        <SidebarGroupContent>{children}</SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { resolved } = useTheme();
  const { logoUrl, hideIaclinLogo } = useClinicBranding();
  const { profile, signOut, user, clinicCategory } = useAuth();
  const { filterNavItems, effectiveRole } = useRoleAccess();
  const { simulatedRole, currentClinicId, isPersonalMode, isClinicOwner, clinicRole } = useAuth();
  const isDentist = effectiveRole === 'dentist';
  const isAdmin = effectiveRole === 'admin' || isClinicOwner;
  const activeConsultation = useActiveConsultation();
  const navigate = useNavigate();
  const [logoutBlocked, setLogoutBlocked] = useState(false);

  const handleSignOut = () => {
    if (activeConsultation) { setLogoutBlocked(true); return; }
    signOut();
  };

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

  const dynamicMap   = isDentist ? getMapForSpecialty(memberSpecialty)  : null;
  const familyConfig = isDentist ? getFamilyConfig(memberSpecialty)     : null;
  const isPsi        = familyConfig?.family === 'psi';
  const isOdonto     = familyConfig?.family === 'odonto';
  const toolsUrl     = familyConfig?.toolsRoute ?? '/ferramentas';

  const filteredPersonalNav = filterNavItems(
    personalNav.filter((item) => item.allowedRoles.includes(effectiveRole))
  );
  const filteredOperationNav = filterNavItems(
    operationNav.filter((item) => item.allowedRoles.includes(effectiveRole))
  );
  const filteredClinicNav = filterNavItems(
    clinicNav
      .filter((item) => item.categories.includes(clinicCategory) && item.allowedRoles.includes(effectiveRole))
      .filter((item) => !(isDentist && item.url === '/odontogram'))
      .filter((item) => !(item.url === '/odontogram' && !isOdonto))
      .filter((item) => !(isPsi && item.url === '/budgets'))
      .map((item) => item.url === '/ferramentas' && toolsUrl !== '/ferramentas' ? { ...item, url: toolsUrl } : item)
  );

  let finalClinicNav = isDentist && dynamicMap
    ? [
        ...filteredClinicNav.slice(0, 2),
        { title: dynamicMap.label, url: '/mapa-clinico', icon: dynamicMap.icon, categories: ALL_CATEGORIES, allowedRoles: ['dentist'] as Role[] },
        ...filteredClinicNav.slice(2),
      ]
    : filteredClinicNav;

  const { data: todayCount = 0 } = useQuery({
    queryKey: ['today-apt-count', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
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

  const { data: todayApts = [] } = useQuery({
    queryKey: ['sidebar-today-apts', currentClinicId, user?.id, isDentist],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      let q = supabase
        .from('appointments')
        .select('id, start_time, status, presence_status, patients(id, full_name)')
        .eq('clinic_id', currentClinicId!)
        .gte('start_time', start)
        .lt('start_time', end)
        .not('status', 'in', '(cancelled)')
        .order('start_time');
      if (isDentist && user) q = q.eq('dentist_id', user.id);
      const { data } = await q;
      return (data ?? []) as Array<{
        id: string;
        start_time: string;
        status: string;
        presence_status: string | null;
        patients: { id: string; full_name: string } | null;
      }>;
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const isActive = (url: string) => {
    if (url === '/') return location.pathname === '/';
    if (location.pathname === url) return true;
    return location.pathname.startsWith(`${url}/`);
  };

  const initials = profile?.full_name
    ?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  const roleKey = clinicRole ?? effectiveRole ?? '';
  const dentistLabel = clinicCategory === 'medico' ? 'Médico' : 'Dentista';
  const displayRole = roleKey === 'dentist'
    ? dentistLabel
    : (ROLE_LABEL[roleKey] ?? '');
  const roleColor = ROLE_COLOR[roleKey] ?? ROLE_COLOR['admin'];

  const renderNavItem = (
    item: { title: string; url: string; icon: typeof LayoutDashboard; beta?: boolean },
    badge?: number,
    exactActive = false,
  ) => {
    const itemIsActive = exactActive ? location.pathname === item.url : isActive(item.url);

    return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={itemIsActive} tooltip={item.title}>
        <NavLink
          to={item.url}
          end={item.url === '/'}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
            itemIsActive
              ? 'bg-gradient-to-r from-primary/12 to-primary/6 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
          }`}
          activeClassName=""
        >
          <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${itemIsActive ? 'text-primary' : ''}`} />
          {!collapsed && (
            <>
              <span className="flex-1">{item.title}</span>
              {item.beta && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-sm">
                  BETA
                </span>
              )}
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
  };

  const STATUS_DOT: Record<string, string> = {
    completed:  'bg-blue-500',
    confirmed:  'bg-green-500',
    scheduled:  'bg-muted-foreground/40',
    no_show:    'bg-amber-500',
    in_service: 'bg-emerald-500',
    arrived:    'bg-amber-400 animate-pulse',
  };

  const TodayPatientsList = () => {
    if (collapsed) return null;
    if (todayApts.length === 0) {
      return (
        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
          Nenhuma consulta hoje
        </div>
      );
    }
    const visible = todayApts.slice(0, 8);
    const rest    = todayApts.length - visible.length;
    return (
      <div className="space-y-0.5 pb-1">
        {visible.map((apt) => {
          const time    = format(parseISO(apt.start_time), 'HH:mm');
          const name    = apt.patients?.full_name ?? 'Paciente';
          const pStatus = apt.presence_status ?? apt.status;
          const dot     = STATUS_DOT[pStatus] ?? STATUS_DOT[apt.status] ?? 'bg-muted-foreground/40';
          return (
            <button
              key={apt.id}
              type="button"
              className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors text-left"
              onClick={() => navigate(`/patients/${apt.patients?.id}`)}
              title={`${time} — ${name}`}
            >
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-[11px] text-muted-foreground font-mono w-9 flex-shrink-0">{time}</span>
              <span className="text-xs text-sidebar-foreground truncate flex-1">{name}</span>
            </button>
          );
        })}
        {rest > 0 && (
          <button
            type="button"
            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors"
            onClick={() => navigate('/pacientes-do-dia')}
          >
            +{rest} mais — ver todos
          </button>
        )}
      </div>
    );
  };

  const prontuarioItem = (
    <SidebarMenuItem key="prontuario">
      <SidebarMenuButton asChild isActive={isActive('/prontuarios')} tooltip="Abrir prontuário">
        <NavLink
          to="/prontuarios"
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
            isActive('/prontuarios')
              ? 'bg-gradient-to-r from-primary/12 to-primary/6 text-primary font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
          }`}
          activeClassName=""
        >
          <FolderHeart className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Abrir prontuário</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const faturamentoItem = (
    <SidebarMenuItem key="faturamento">
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
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">

      {/* ── Header: Logo + Perfil ── */}
      <SidebarHeader className="p-4 bg-background border-b border-sidebar-border/60 gap-0">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-0">
          {(() => {
            const iaclinSrc  = resolved === 'dark' ? logoDark : logoLight;
            const showIaclin = !(hideIaclinLogo && logoUrl);
            const showClinic = !!logoUrl;
            const sz         = collapsed ? 'h-8 w-8 object-contain flex-shrink-0' : 'h-8 object-contain';
            return (
              <div className="flex items-center gap-2">
                {showIaclin && <img src={iaclinSrc} alt="IACLIN" className={sz} />}
                {showIaclin && showClinic && !collapsed && <span className="text-muted-foreground/40 text-sm">·</span>}
                {showClinic && <img src={logoUrl!} alt="Logo da clínica" className={collapsed ? 'h-8 w-8 object-contain flex-shrink-0' : 'h-8 object-contain'} />}
              </div>
            );
          })()}
        </div>

        {/* Perfil do usuário */}
        {!collapsed ? (
          <div
            className="flex items-center gap-3 mt-3 p-2 rounded-xl bg-sidebar-accent/20 border border-sidebar-border cursor-pointer hover:bg-sidebar-accent/30 transition-colors"
            onClick={() => navigate('/perfil')}
            title="Meu perfil"
          >
            <Avatar className={`h-8 w-8 flex-shrink-0 ring-2 ring-offset-1 ring-offset-sidebar ${roleColor.ring}`}>
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                {profile?.full_name ?? user?.email}
              </p>
              {displayRole && (
                <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${roleColor.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${roleColor.dot}`} />
                  {displayRole}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className="mt-2 mx-auto cursor-pointer"
            onClick={() => navigate('/perfil')}
            title={profile?.full_name ?? 'Meu perfil'}
          >
            <Avatar className={`h-7 w-7 ring-2 ring-offset-1 ring-offset-sidebar ${roleColor.ring}`}>
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent className="px-2 py-2 gap-0">

        {/* PESSOAL */}
        {filteredPersonalNav.length > 0 && (
          <NavSection id="pessoal" label="Pessoal" collapsed={collapsed}>
            <SidebarMenu>
              {filteredPersonalNav.map((item) =>
                renderNavItem(item, (item.url === '/minha-agenda') ? todayCount : undefined)
              )}
              {effectiveRole !== 'patient' && renderNavItem({ title: 'Meu Perfil', url: '/perfil', icon: UserIcon })}
            </SidebarMenu>
          </NavSection>
        )}

        {/* Clinic Switcher */}
        <div className="py-1.5 px-0">
          <ClinicSwitcher />
        </div>

        {/* ── Admin com clínica ativa ── */}
        {isAdmin && currentClinicId ? (() => {
          const byUrl = (url: string) => finalClinicNav.find((i) => i.url === url);
          const credentialingsItem = byUrl('/clinica/credenciamentos');

          const attendanceExtra = [byUrl('/pacientes-do-dia'), byUrl('/clinica/aprovacoes')].filter(Boolean) as typeof finalClinicNav;
          const attendance      = [...filteredOperationNav, ...attendanceExtra];
          const patientItems    = [byUrl('/patients'), byUrl('/ferramentas'), byUrl('/odontogram')].filter(Boolean) as typeof finalClinicNav;
          const financialItems  = [byUrl('/financial'), byUrl('/budgets')].filter(Boolean) as typeof finalClinicNav;
          const automationItems = [byUrl('/secretaria-ia')].filter(Boolean) as typeof finalClinicNav;

          return (
            <>
              {/* GESTÃO DA CLÍNICA */}
              <NavSection id="gestao" label="Gestão da Clínica" collapsed={collapsed}>
                <SidebarMenu>
                  {renderNavItem({ title: 'Visão Geral',   url: '/clinica',         icon: Building2 }, undefined, true)}
                  {renderNavItem({ title: 'Equipe Médica', url: '/clinica/medicos', icon: Stethoscope }, undefined, true)}
                  {credentialingsItem && renderNavItem(credentialingsItem, undefined, true)}
                </SidebarMenu>
              </NavSection>

              {/* ATENDIMENTO DO DIA */}
              {attendance.length > 0 && (
                <NavSection id="atendimento" label="Atendimento do Dia" collapsed={collapsed}>
                  <SidebarMenu>
                    {attendance.map((item) =>
                      renderNavItem(
                        item,
                        item.url === '/agenda' || item.url === '/pacientes-do-dia'
                          ? todayCount
                          : item.url === '/clinica/aprovacoes'
                          ? pendingCount
                          : undefined,
                      )
                    )}
                  </SidebarMenu>
                </NavSection>
              )}

              {/* PACIENTES & CLÍNICO */}
              {patientItems.length > 0 && (
                <NavSection id="pacientes" label="Pacientes & Clínico" collapsed={collapsed}>
                  <SidebarMenu>
                    {patientItems.map((item) => renderNavItem(item))}
                    {prontuarioItem}
                  </SidebarMenu>
                </NavSection>
              )}

              {/* FINANCEIRO */}
              {financialItems.length > 0 && (
                <NavSection id="financeiro" label="Financeiro" collapsed={collapsed} defaultOpen={false}>
                  <SidebarMenu>
                    {financialItems.map((item) => renderNavItem(item))}
                    {faturamentoItem}
                  </SidebarMenu>
                </NavSection>
              )}

              {/* AUTOMAÇÃO */}
              {automationItems.length > 0 && (
                <NavSection id="automacao" label="Automação" collapsed={collapsed} defaultOpen={false}>
                  <SidebarMenu>
                    {automationItems.map((item) => renderNavItem(item))}
                    {renderNavItem({ title: 'IA Gestor', url: '/ia-gestor', icon: Brain })}
                  </SidebarMenu>
                </NavSection>
              )}

              {/* PACIENTES DO DIA */}
              {!collapsed && (
                <NavSection id="pacientes-dia" label={`Pacientes do Dia${todayApts.length > 0 ? ` (${todayApts.length})` : ''}`} collapsed={collapsed} defaultOpen={false}>
                  <TodayPatientsList />
                </NavSection>
              )}
            </>
          );
        })() : (
          <>
            {/* ── Secretária / Dentista sem ser admin ── */}
            {filteredOperationNav.length > 0 && (
              <NavSection id="atendimento" label="Atendimento do Dia" collapsed={collapsed}>
                <SidebarMenu>
                  {filteredOperationNav.map((item) =>
                    renderNavItem(item, item.url === '/agenda' ? todayCount : undefined)
                  )}
                </SidebarMenu>
              </NavSection>
            )}

            {isPersonalMode && (effectiveRole === 'dentist' || effectiveRole === 'admin') && (
              <NavSection id="automacao" label="Automação" collapsed={collapsed} defaultOpen={false}>
                <SidebarMenu>
                  {renderNavItem({ title: 'Secretária IA', url: '/secretaria-ia', icon: Bot })}
                </SidebarMenu>
              </NavSection>
            )}

            {currentClinicId && (
              <NavSection id="clinica" label="Clínica" collapsed={collapsed}>
                <SidebarMenu>
                  {finalClinicNav.map((item) =>
                    renderNavItem(
                      item,
                      item.url === '/clinica/aprovacoes' ? pendingCount
                      : item.url === '/pacientes-do-dia' ? todayCount
                      : undefined,
                    )
                  )}
                </SidebarMenu>
              </NavSection>
            )}

            {(effectiveRole === 'admin' || effectiveRole === 'dentist' || effectiveRole === 'secretary') && (
              <SidebarGroup className="py-0">
                <SidebarGroupContent>
                  <SidebarMenu>{prontuarioItem}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {(effectiveRole === 'dentist' || effectiveRole === 'secretary') && currentClinicId && (
              <NavSection id="automacao-dentist" label="Automação" collapsed={collapsed} defaultOpen={false}>
                <SidebarMenu>
                  {renderNavItem({ title: 'IA Gestor', url: '/ia-gestor', icon: Brain })}
                </SidebarMenu>
              </NavSection>
            )}

            {!collapsed && currentClinicId && (
              <NavSection id="pacientes-dia" label={`Pacientes do Dia${todayApts.length > 0 ? ` (${todayApts.length})` : ''}`} collapsed={collapsed} defaultOpen={false}>
                <TodayPatientsList />
              </NavSection>
            )}

            {!isDentist && effectiveRole !== 'patient' && (
              <NavSection id="gestao" label="Gestão da Clínica" collapsed={collapsed} defaultOpen={false}>
                <SidebarMenu>
                  {renderNavItem({ title: 'Visão Geral', url: '/clinica',        icon: Building2 }, undefined, true)}
                  {renderNavItem({ title: 'Médicos',     url: '/clinica/medicos', icon: Stethoscope }, undefined, true)}
                  {faturamentoItem}
                </SidebarMenu>
              </NavSection>
            )}
          </>
        )}

        {/* Configurações — sempre no fundo */}
        <div className="flex-1" />
        {!isDentist && (
          <SidebarGroup className="py-0 mt-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavItem({ title: 'Configurações', url: '/settings', icon: Settings })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ── Footer: apenas sair ── */}
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <TooltipProvider>
          {!collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Encerrar sessão</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mx-auto block"
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
              Conclua a consulta atual antes de sair do sistema.
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
