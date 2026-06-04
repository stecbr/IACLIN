import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, FileHeart, DollarSign, ClipboardList,
  Settings, Search, FolderHeart, CalendarClock, CalendarDays, DoorOpen,
  ClipboardCheck, Building2, Briefcase, Bot, User as UserIcon, Sparkles,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAuth } from '@/contexts/AuthContext';

type PageItem = { name: string; url: string; icon: typeof LayoutDashboard; group: string; categories?: string[] };

const allPages: PageItem[] = [
  // Pessoal
  { name: 'Dashboard', url: '/', icon: LayoutDashboard, group: 'Pessoal' },
  { name: 'Minha Agenda', url: '/minha-agenda', icon: Calendar, group: 'Pessoal' },
  { name: 'Disponibilidade', url: '/disponibilidade', icon: CalendarClock, group: 'Pessoal' },
  { name: 'Meu Perfil', url: '/perfil', icon: UserIcon, group: 'Pessoal' },
  // Operação
  { name: 'Agenda', url: '/agenda', icon: Calendar, group: 'Operação' },
  { name: 'Sala de Espera', url: '/sala-de-espera', icon: DoorOpen, group: 'Operação' },
  { name: 'Pacientes do Dia', url: '/pacientes-do-dia', icon: CalendarDays, group: 'Operação' },
  // Clínica
  { name: 'Pacientes', url: '/patients', icon: Users, group: 'Clínica' },
  { name: 'Abrir prontuário', url: '/prontuarios', icon: FolderHeart, group: 'Clínica' },
  { name: 'Odontograma', url: '/odontogram', icon: FileHeart, group: 'Clínica', categories: ['odonto'] },
  { name: 'Ferramentas Clínicas', url: '/ferramentas', icon: Briefcase, group: 'Clínica' },
  { name: 'Orçamentos', url: '/budgets', icon: ClipboardList, group: 'Clínica' },
  { name: 'Aprovações', url: '/clinica/aprovacoes', icon: ClipboardCheck, group: 'Clínica' },
  { name: 'Credenciamentos', url: '/clinica/credenciamentos', icon: Building2, group: 'Clínica' },
  // Financeiro & IA
  { name: 'Financeiro', url: '/financial', icon: DollarSign, group: 'Gestão' },
  { name: 'Secretária IA', url: '/secretaria-ia', icon: Bot, group: 'Gestão' },
  { name: 'Atendimentos IA', url: '/atendimentos-ia', icon: Sparkles, group: 'Gestão' },
  { name: 'IA Gestor', url: '/ia-gestor', icon: Sparkles, group: 'Gestão' },
  // Configuração
  { name: 'Configurações', url: '/settings', icon: Settings, group: 'Configuração' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { filterNavItems } = useRoleAccess();
  const { clinicCategory } = useAuth();

  const pages = filterNavItems(
    allPages.filter((p) => !p.categories || p.categories.includes(clinicCategory))
  );
  const groups = Array.from(new Set(pages.map((p) => p.group)));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const go = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-muted-foreground text-sm hover:bg-muted transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar pacientes, páginas..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g} heading={g}>
              {pages.filter((p) => p.group === g).map((p) => (
                <CommandItem key={p.url} onSelect={() => go(p.url)}>
                  <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
