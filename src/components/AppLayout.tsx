import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { WelcomeTour } from '@/components/WelcomeTour';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { ActiveConsultationBar } from '@/components/ActiveConsultationBar';
import { FloatingConsultationButton } from '@/components/FloatingConsultationButton';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { useAuth } from '@/contexts/AuthContext';
import { useAiSync } from '@/hooks/useAiSync';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useClinicBranding } from '@/hooks/useClinicBranding';

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
  const { resolved, setTheme } = useTheme();
  const { currentClinicId } = useAuth();
  const { effectiveRole } = useRoleAccess();
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />
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
            </div>
            <div className="flex items-center gap-1">
              <DevRoleSwitcher />
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
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <FloatingConsultationButton />
      <WelcomeTour />
    </SidebarProvider>
  );
}
