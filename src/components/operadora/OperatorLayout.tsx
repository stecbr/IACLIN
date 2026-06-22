import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import { GettingStartedChecklist } from "@/components/GettingStartedChecklist";
import {
  LayoutDashboard,
  Users,
  UserRoundSearch,
  Inbox,
  Calendar,
  Settings,
  LogOut,
  ArrowRight,
  PanelLeft,
  Sun,
  Moon,
  Building2,
  Send,
  ClipboardCheck,
  Wallet,
  ShieldCheck,
  MessageSquare,
  Table2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import iaclinDefaultLogo from "@/assets/iaclin-logo.png.asset.json";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = { to: string; label: string; icon: any; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/operadora", label: "Visão geral", icon: LayoutDashboard, end: true },
      { to: "/operadora/rede", label: "Rede credenciada", icon: Users },
      { to: "/operadora/agenda", label: "Agenda", icon: Calendar },
    ],
  },
  {
    label: "Onboarding",
    items: [
      { to: "/operadora/pedidos", label: "Pedidos", icon: Inbox },
      { to: "/operadora/profissionais", label: "Rede de Busca", icon: UserRoundSearch },
    ],
  },
  {
    label: "Atendimentos",
    items: [
      { to: "/operadora/atendimentos", label: "Confirmações", icon: ClipboardCheck },
      { to: "/operadora/beneficiarios", label: "Beneficiários", icon: ShieldCheck },
      { to: "/operadora/faturamento", label: "Faturamento", icon: Wallet },
      { to: "/operadora/tabela-valores", label: "Tabela de Valores", icon: Table2 },
    ],
  },
  {
    label: "Suporte",
    items: [{ to: "/operadora/chamados", label: "Chamados", icon: MessageSquare }],
  },
  {
    label: "Conta",
    items: [{ to: "/operadora/configuracoes", label: "Configurações", icon: Settings }],
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
  const { signOut, profile, operatorId, user } = useAuth();
  const [op, setOp] = useState<OperatorInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!operatorId) return;
    supabase
      .from("insurance_operators")
      .select("name, cnpj, logo_url, is_active")
      .eq("id", operatorId)
      .single()
      .then(({ data }) => data && setOp(data as OperatorInfo));
  }, [operatorId]);

  useEffect(() => {
    if (!operatorId) return;
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("operator_credentialings")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", operatorId)
        .eq("status", "pending");
      if (!cancelled) setPendingCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel(`op-pending-${operatorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_credentialings", filter: `operator_id=eq.${operatorId}` },
        () => fetchCount(),
      )
      .subscribe();
    const interval = setInterval(fetchCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [operatorId, location.pathname]);

  const badgeFor = (to: string) => (to === "/operadora/pedidos" && pendingCount > 0 ? pendingCount : null);

  const initials = (op?.name ?? "OP")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`operator-scope ${resolved === "dark" ? "dark" : ""} h-screen overflow-hidden flex w-full bg-background`}>
      {/* Full sidebar */}
      <aside
        className={`hidden ${sidebarOpen ? "md:flex" : "md:hidden"} w-72 flex-col bg-sidebar text-sidebar-foreground sticky top-0 h-screen overflow-hidden`}
      >
        {/* Operator brand block: logo, status badge above name, and description */}
        <div className="px-5 py-5 border-sidebar-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 flex items-center justify-center">
              <img
                src={op?.logo_url || iaclinDefaultLogo.url}
                alt={op?.name ?? "Operadora"}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-sidebar-foreground truncate">{op?.name ?? "Operadora"}</div>
              <div className="text-[11px] text-sidebar-foreground/60 truncate">Gestão de Operadora</div>
              {op?.cnpj && <div className="text-[10px] text-sidebar-foreground/60 truncate">CNPJ {op.cnpj}</div>}
            </div>
          </div>
        </div>

        {/* Nav groups (scrollable) */}
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
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary -ml-px pl-[calc(0.75rem-1px)]"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {badgeFor(item.to) !== null && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                        {badgeFor(item.to)}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer (user card) */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <TooltipProvider>
            <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/20 border border-sidebar-border hover:bg-sidebar-accent/30 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted-foreground/10 text-sidebar-accent-foreground text-xs font-medium">
                  {profile?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                  {profile?.full_name ?? user?.email ?? "Usuário"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="p-2 rounded-xl border border-sidebar-border text-sidebar-accent-foreground hover:bg-sidebar-accent/40 transition-colors"
                    aria-label="Sair"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sair</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </aside>

      {/* Collapsed icon rail */}
      <aside
        className={`hidden ${!sidebarOpen ? "md:flex" : "md:hidden"} w-16 flex-col items-center bg-sidebar text-sidebar-foreground sticky top-0 h-screen`}
      >
        <div className="py-4 w-full flex items-center justify-center">
          <div className="h-10 w-10 flex items-center justify-center">
            <img
              src={op?.logo_url || iaclinDefaultLogo.url}
              alt={op?.name ?? "Operadora"}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <TooltipProvider delayDuration={100}>
          <nav
            className="flex-1 w-full py-2 flex flex-col items-center gap-1 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {navGroups
              .filter((g) => g.label !== "Conta")
              .map((group, gi, arr) => (
                <div key={group.label} className="w-full flex flex-col items-center gap-1">
                  {group.items.map((item) => {
                    const active = item.end
                      ? location.pathname === item.to
                      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                    return (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={`relative flex items-center justify-center h-10 w-10 leading-none rounded-xl transition-colors ${
                              active
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                            }`}
                          >
                            <item.icon size={18} strokeWidth={2} className="block shrink-0" />
                            {badgeFor(item.to) !== null && (
                              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold">
                                {badgeFor(item.to)}
                              </span>
                            )}
                          </NavLink>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {gi < arr.length - 1 && <div className="h-px w-6 bg-sidebar-border my-1" />}
                </div>
              ))}
          </nav>
          <div className="w-full py-3 border-t border-sidebar-border flex flex-col items-center gap-2">
            {navGroups
              .find((g) => g.label === "Conta")
              ?.items.map((item) => {
                const active =
                  location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.to}
                        className={`flex items-center justify-center h-10 w-10 leading-none rounded-xl transition-colors ${
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <item.icon size={18} strokeWidth={2} className="block shrink-0" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted-foreground/10 text-sidebar-accent-foreground text-xs font-medium">
                {profile?.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </TooltipProvider>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {location.pathname !== "/operadora/profissionais" && (
          <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-sidebar sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden md:flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen((s) => !s)}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-muted/5 transition-colors"
                  aria-label="Alternar sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              </div>
              <div className="md:hidden h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center overflow-hidden">
                <img
                  src={op?.logo_url || iaclinDefaultLogo.url}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            <div className="flex-1 px-4">
              <Input placeholder="Buscar na operadora..." className="w-full h-9 rounded-xl" />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Alternar tema"
              >
                {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <NotificationBell />
            </div>
          </header>
        )}
        <main className="flex-1 min-h-0 pr-3 pb-3 md:pr-4 md:pb-4 bg-sidebar">
          <div className="h-full bg-background rounded-xl overflow-y-auto p-4 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children ?? <Outlet />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <GettingStartedChecklist />
    </div>
  );
}
