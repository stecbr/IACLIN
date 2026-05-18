import { ReactNode } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Inbox, Calendar, Settings, LogOut, Sun, Moon, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { NotificationBell } from '@/components/NotificationBell';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { motion, AnimatePresence } from 'framer-motion';

const nav = [
  { to: '/operadora', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/operadora/rede', label: 'Rede credenciada', icon: Users },
  { to: '/operadora/pedidos', label: 'Pedidos', icon: Inbox },
  { to: '/operadora/agenda', label: 'Agenda', icon: Calendar },
  { to: '/operadora/configuracoes', label: 'Configurações', icon: Settings },
];

export function OperatorLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { resolved, setTheme } = useTheme();
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar p-4 gap-1">
        <div className="flex items-center gap-2 px-2 pb-4">
          <img src={resolved === 'dark' ? logoDark : logoLight} alt="IACLIN" className="h-7 object-contain" />
          <span className="text-xs text-muted-foreground border-l border-border pl-2 ml-1">Operadora</span>
        </div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {profile?.full_name ?? 'Operadora'}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Painel da operadora</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
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