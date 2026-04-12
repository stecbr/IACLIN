import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CommandPalette } from '@/components/CommandPalette';

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/agenda': 'Agenda',
  '/patients': 'Pacientes',
  '/odontogram': 'Odontograma',
  '/financial': 'Financeiro',
  '/settings': 'Configurações',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.startsWith('/patients/')) return ['Pacientes', 'Detalhes'];
    const label = breadcrumbMap[path];
    return label ? [label] : ['Página'];
  };

  const crumbs = getBreadcrumb();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
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
            <div className="flex items-center gap-2">
              <CommandPalette />
            </div>
          </header>
          <main className="flex-1 p-6">
            <div className="animate-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
