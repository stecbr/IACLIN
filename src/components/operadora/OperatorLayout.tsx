import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Inbox,
  Calendar,
  Settings,
  LogOut,
  Sun,
  Moon,
  Building2,
  Send,
  ClipboardCheck,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { NotificationBell } from '@/components/NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

type NavItem = { to: string; label: string; icon: any; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { to: '/operadora', label: 'Visão geral', icon: LayoutDashboard, end: true },
      { to: '/operadora/rede', label: 'Rede credenciada', icon: Users },
      { to: '/operadora/agenda', label: 'Agenda', icon: Calendar },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { to: '/operadora/pedidos', label: 'Pedidos', icon: Inbox },
      { to: '/operadora/convites', label: 'Convites', icon: Send },
    ],
  },
  {
    label: 'Atendimentos',
    items: [
      { to: '/operadora/atendimentos', label: 'Confirmações', icon: ClipboardCheck },
      { to: '/operadora/faturamento', label: 'Faturamento', icon: Wallet },
    ],
  },
  {
    label: 'Conta',
    items: [
      { to: '/operadora/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

interface OperatorInfo {
  name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  is_active: boolean | null;
}

export function OperatorLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { resolved, setTheme } = useTheme();
  const { signOut, profile, operatorId } = useAuth();
  const [op, setOp] = useState<OperatorInfo | null>(null);

  useEffect(() => {
    if (!operatorId) return;
    supabase
      .from('insurance_operators')
      .select('name, cnpj, logo_url, is_active')
      .eq('id', operatorId)
      .single()
      .then(({ data }) => data && setOp(data as OperatorInfo));
  }, [operatorId]);

  const initials = (op?.name ?? 'OP')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`operator-scope ${resolved === 'dark' ? 'dark' : ''} min-h-screen flex w-full bg-background`}>
      <aside className="hidden md:flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Operator brand block */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-md bg-sidebar-accent flex items-center justify-center overflow-hidden ring-1 ring-sidebar-border shrink-0">
              {op?.logo_url ? (
                <img src={op.logo_url} alt={op.name ?? 'Operadora'} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-sidebar-primary">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 leading-none">
                Painel B2B
              </div>
              <div className="text-sm font-semibold text-white truncate mt-1">
                {op?.name ?? 'Operadora'}
              </div>
              {op?.cnpj && (
                <div className="text-[10px] text-sidebar-foreground/60 truncate mt-0.5">
                  CNPJ {op.cnpj}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary -ml-px pl-[calc(0.75rem-1px)]'
                          : 'text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent/60'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="px-3 py-1.5 text-xs text-sidebar-foreground/70 truncate">
            {profile?.full_name ?? 'Usuário'}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between border-b border-border px-4 md:px-6 bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center overflow-hidden">
              {op?.logo_url ? (
                <img src={op.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">
                  {op?.name ?? 'Painel da operadora'}
                </span>
                <Badge
                  variant={op?.is_active ? 'default' : 'secondary'}
                  className="text-[10px] uppercase tracking-wide"
                >
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {op?.is_active ? 'Ativa' : 'Pendente'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground hidden sm:block">
                Gestão de credenciamento, rede e faturamento
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
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
  );
}