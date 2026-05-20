import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, FileHeart, DollarSign, ClipboardList, Settings, Search, FolderHeart } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const pages = [
  { name: 'Dashboard', url: '/', icon: LayoutDashboard },
  { name: 'Agenda', url: '/agenda', icon: Calendar },
  { name: 'Pacientes', url: '/patients', icon: Users },
  { name: 'Abrir prontuário', url: '/prontuarios', icon: FolderHeart },
  { name: 'Odontograma', url: '/odontogram', icon: FileHeart },
  { name: 'Financeiro', url: '/financial', icon: DollarSign },
  { name: 'Orçamentos', url: '/budgets', icon: ClipboardList },
  { name: 'Configurações', url: '/settings', icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
          <CommandGroup heading="Páginas">
            {pages.map((p) => (
              <CommandItem key={p.url} onSelect={() => go(p.url)}>
                <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
