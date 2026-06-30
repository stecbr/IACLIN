import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, Database } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operadoras"
        description="Gerencie solicitações de cadastro e o catálogo de operadoras e planos aceitos na plataforma."
      />
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="flex md:flex-col gap-1 md:w-48 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 shrink-0">
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
        <div className="flex-1 min-w-0 rounded-xl border bg-card p-4 md:p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}