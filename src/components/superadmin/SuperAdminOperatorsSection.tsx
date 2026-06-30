import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, Database, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  {
    to: '/superadmin/operadoras/cadastro',
    label: 'Cadastro',
    description: 'Solicitações em análise, aprovadas e recusadas',
    icon: ClipboardList,
  },
  {
    to: '/superadmin/operadoras/banco-de-dados',
    label: 'Banco de dados',
    description: 'Catálogo de operadoras e planos aceitos no sistema',
    icon: Database,
  },
];

export function SuperAdminOperatorsSection() {
  const location = useLocation();

  return (
    <div className="flex flex-col lg:flex-row gap-6 -m-4 md:-m-6 p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
      {/* Sub-sidebar interna */}
      <aside className="lg:w-64 lg:shrink-0">
        <div className="lg:sticky lg:top-20 space-y-1">
          <div className="flex items-center gap-2 px-3 pb-3 mb-1 border-b">
            <HeartPulse className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operadoras
            </span>
          </div>
          {items.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors border border-transparent',
                  active
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-foreground hover:bg-muted/60',
                )}
              >
                <item.icon className={cn('h-4 w-4 mt-0.5 shrink-0', active && 'text-primary')} />
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {item.description}
                  </p>
                </div>
              </NavLink>
            );
          })}
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}