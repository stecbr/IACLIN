import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronsUpDown, User } from 'lucide-react';
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
  const { clinics, currentClinicId, switchClinic, isPersonalMode, roles } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (clinics.length <= 1) return null;

  const current = clinics.find((c) => c.clinic_id === currentClinicId);
  const isDentist = roles.includes('dentist');
  const personalClinic = isDentist ? clinics.find((c) => c.is_owner) : undefined;
  const otherClinics = clinics.filter((c) => c.clinic_id !== personalClinic?.clinic_id);
  const triggerIsPersonal = isPersonalMode;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 rounded-lg p-2 hover:bg-sidebar-accent/60 transition-colors ${
            collapsed ? 'justify-center' : ''
          } ${triggerIsPersonal ? 'ring-1 ring-amber-500/40 bg-amber-500/5' : ''}`}
        >
          <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${triggerIsPersonal ? 'bg-amber-500/15' : 'bg-primary/10'}`}>
            {triggerIsPersonal ? (
              <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Building2 className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-foreground truncate">
                  {triggerIsPersonal ? 'Meus Pacientes' : current?.clinic_name ?? 'Clínica'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">
                  {triggerIsPersonal ? 'Modo pessoal' : current?.role}
                </p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {personalClinic && (
          <>
            <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400">Modo pessoal</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => switchClinic(personalClinic.clinic_id)}
              className="gap-2"
            >
              <div className="h-7 w-7 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Meus Pacientes</p>
                <p className="text-[10px] text-muted-foreground">Pacientes pessoais do médico</p>
              </div>
              {personalClinic.clinic_id === currentClinicId && <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {personalClinic ? 'Clínicas vinculadas' : 'Trocar clínica'}
        </DropdownMenuLabel>
        {otherClinics.map((c) => (
          <DropdownMenuItem
            key={c.clinic_id}
            onClick={() => switchClinic(c.clinic_id)}
            className="gap-2"
          >
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
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
