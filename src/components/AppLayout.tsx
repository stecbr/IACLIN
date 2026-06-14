import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, User, ArrowLeft, Stethoscope, Shield, ClipboardList, Building2 as BuildingIcon, UserCircle } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { WelcomeTour } from '@/components/WelcomeTour';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { ActiveConsultationBar } from '@/components/ActiveConsultationBar';
import { FloatingConsultationButton } from '@/components/FloatingConsultationButton';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { useAuth } from '@/contexts/AuthContext';
import { useAiSync } from '@/hooks/useAiSync';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useProfessionalLabel } from '@/hooks/useProfessionalLabel';
import { useClinicBranding } from '@/hooks/useClinicBranding';
import { FirstAccessClinicDialog } from '@/components/FirstAccessClinicDialog';
import { PublishPendingBanner } from '@/components/PublishPendingBanner';

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/agenda': 'Agenda',
  '/patients': 'Pacientes',
  '/odontogram': 'Odontograma',
  '/financial': 'Financeiro',
  '/budgets': 'Orçamentos',
  '/settings': 'Configurações',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolved, setTheme } = useTheme();
  const { currentClinicId, isPersonalMode, clinicRole } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const { label: professionalLabel, isOdonto } = useProfessionalLabel();

  const dentistChip = isOdonto
    ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-cyan-500/30'
    : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/30';

  const HEADER_ROLE_CONFIG: Record<string, { label: string; chip: string; Icon: typeof User }> = {
    admin:     { label: 'IACLINADMIN',     chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',    Icon: Shield },
    dentist:   { label: professionalLabel, chip: dentistChip,                                                                   Icon: Stethoscope },
    secretary: { label: 'Secretária',      chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/30',            Icon: ClipboardList },
    owner:     { label: 'IACLINADMIN',     chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',    Icon: Shield },
    operator:  { label: 'Operadora',       chip: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/30',    Icon: BuildingIcon },
    patient:   { label: 'Paciente',        chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30', Icon: UserCircle },
  };
  const activeRoleKey = clinicRole ?? effectiveRole ?? '';
  const roleConfig = HEADER_ROLE_CONFIG[activeRoleKey] ?? HEADER_ROLE_CONFIG['admin'];
  const { logoUrl, hideIaclinLogo } = useClinicBranding();
  // Snapshot inicial + polling de agendamentos criados pela IA (fire-and-forget).
  // Só roda para admin (dono/secretária da clínica). Médicos não disparam o sync,
  // pois não precisam abrir snapshot completo nem polling externo.
  useAiSync(effectiveRole === 'admin' ? currentClinicId : null);

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.startsWith('/patients/')) return ['Pacientes', 'Detalhes'];
    const label = breadcrumbMap[path];
    return label ? [label] : ['Página'];
  };

  const crumbs = getBreadcrumb();
  const toggleTheme = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  const [backNav, setBackNav] = useState<{ to: string; from: string; label: string } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('iaclin.backNav');
      if (!raw) { setBackNav(null); return; }
      const parsed = JSON.parse(raw) as { to: string; from: string; label: string };
      if (parsed?.to && location.pathname.startsWith(parsed.to)) {
        setBackNav(parsed);
      } else {
        sessionStorage.removeItem('iaclin.backNav');
        setBackNav(null);
      }
    } catch {
      setBackNav(null);
    }
  }, [location.pathname]);

  const handleBack = () => {
    if (!backNav) return;
    sessionStorage.removeItem('iaclin.backNav');
    navigate(backNav.from);
  };

  const isFixedHeightPage = location.pathname.startsWith('/ia-gestor');

  return (
    <SidebarProvider>
      <div className={`flex w-full ${isFixedHeightPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />
              {backNav && (
                <button
                  onClick={handleBack}
                  title={backNav.label}
                  aria-label={backNav.label}
                  className="inline-flex items-center justify-center rounded-full border border-border/60 bg-muted/40 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Mobile logo */}
              <div className="flex md:hidden items-center gap-2">
                {!(hideIaclinLogo && logoUrl) && (
                  <img src={resolved === 'dark' ? logoDark : logoLight} alt="IACLIN" className="h-7 object-contain" />
                )}
                {logoUrl && !(hideIaclinLogo) && <span className="text-muted-foreground/40 text-sm">·</span>}
                {logoUrl && <img src={logoUrl} alt="Logo da clínica" className="h-7 object-contain" />}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                {crumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-foreground/40">/</span>}
                    <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
              {isPersonalMode && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium ring-1 ring-amber-500/30">
                  <User className="h-3 w-3" />
                  Modo Pessoal
                </span>
              )}
              {roleConfig && (
                <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${roleConfig.chip}`}>
                  <roleConfig.Icon className="h-3 w-3" />
                  {roleConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <CommandPalette />
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <NotificationBell />
            </div>
          </header>
          <ActiveConsultationBar />
          <main className={`flex-1 flex flex-col p-4 md:p-6 pb-24 md:pb-6 min-h-0 ${
            isFixedHeightPage ? 'overflow-hidden' : ''
          }`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 flex flex-col min-h-0"
              >
                <PublishPendingBanner />
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <FloatingConsultationButton />
      <WelcomeTour />
      <FirstAccessClinicDialog />
    </SidebarProvider>
  );
}
