import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, Database } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useSidebar } from '@/components/ui/sidebar';

const items = [
  {
    to: '/superadmin/operadoras/cadastro',
    label: 'Cadastro',
    icon: ClipboardList,
  },
  {
    to: '/superadmin/operadoras/banco-de-dados',
    label: 'Banco de dados',
    icon: Database,
  },
];

export function SuperAdminOperatorsSection() {
  const location = useLocation();
  const { setOpen, open } = useSidebar();
  // Colapsa a sidebar principal automaticamente nesta tela para liberar espaço,
  // restaurando o estado anterior ao sair.
  useEffect(() => {
    const prev = open;
    setOpen(false);
    return () => setOpen(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2rem)] md:h-[calc(100vh-3.5rem-3rem)]">
      <PageHeader
        title="Operadoras"
        description="Gerencie solicitações de cadastro e o catálogo de operadoras e planos aceitos na plataforma."
      />
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 mt-6">
        <nav className="flex md:flex-col gap-1 md:w-48 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 shrink-0 md:self-start md:sticky md:top-0">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0 min-h-0 rounded-xl border bg-card shadow-sm overflow-y-auto p-4 md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}