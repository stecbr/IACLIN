import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';

export function ClinicSwitcher() {
  const { clinics, currentClinicId, switchClinic } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (clinics.length <= 1) return null;

  const current = clinics.find((c) => c.clinic_id === currentClinicId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 rounded-lg p-2 hover:bg-sidebar-accent/60 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-foreground truncate">{current?.clinic_name ?? 'Clínica'}</p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">{current?.role}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar clínica</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clinics.map((c) => (
          <DropdownMenuItem
            key={c.clinic_id}
            onClick={() => switchClinic(c.clinic_id)}
            className="gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.clinic_name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{c.role} {c.is_owner && '· dono'}</p>
            </div>
            {c.clinic_id === currentClinicId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
