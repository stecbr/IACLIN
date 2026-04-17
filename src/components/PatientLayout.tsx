import { Outlet, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { PatientSidebar } from '@/components/PatientSidebar';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

const breadcrumbMap: Record<string, string> = {
  '/paciente': 'Dashboard',
  '/paciente/plano': 'Plano de Saúde',
  '/paciente/agendas': 'Minhas Agendas',
  '/paciente/exames': 'Meus Exames',
  '/paciente/configuracoes': 'Configurações',
};

export function PatientLayout() {
  const location = useLocation();
  const { resolved, setTheme } = useTheme();

  const crumb = breadcrumbMap[location.pathname] ?? 'Página';
  const toggleTheme = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <PatientSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />
              <div className="flex md:hidden items-center">
                <img
                  src={resolved === 'dark' ? logoDark : logoLight}
                  alt="IACLIN"
                  className="h-7 object-contain"
                />
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Paciente</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground">{crumb}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
