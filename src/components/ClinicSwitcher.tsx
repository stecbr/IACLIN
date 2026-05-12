import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronsUpDown, Plus, User, BadgePlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { JoinClinicDialog } from '@/components/JoinClinicDialog';
import { RegisterClinicDialog } from '@/components/RegisterClinicDialog';

export function ClinicSwitcher() {
  const { clinics, currentClinicId, switchClinic, switchToPersonal, isPersonalMode, roles } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const isDentist = roles.includes('dentist');
  const [joinOpen, setJoinOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // Always show for dentists (personal scope + link option). Hide entirely for patients.
  if (roles.includes('patient') && !isDentist) return null;

  const current = clinics.find((c) => c.clinic_id === currentClinicId);
  const triggerIsPersonal = isPersonalMode;
  const ownsClinic = clinics.some((c) => c.is_owner);

  return (
    <>
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
        {isDentist && (
          <>
            <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400">Atendimentos pessoais</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => switchToPersonal()}
              className="gap-2"
            >
              <div className="h-7 w-7 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Meus Pacientes</p>
                <p className="text-[10px] text-muted-foreground">Sem vínculo com clínica</p>
              </div>
              {isPersonalMode && <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {isDentist ? 'Clínicas vinculadas' : 'Trocar clínica'}
        </DropdownMenuLabel>
        {clinics.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            Nenhuma clínica vinculada.
          </div>
        )}
        {clinics.map((c) => (
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
            {!isPersonalMode && c.clinic_id === currentClinicId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setJoinOpen(true)} className="gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Plus className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Vincular nova clínica</p>
            <p className="text-[10px] text-muted-foreground">Use um código de convite</p>
          </div>
        </DropdownMenuItem>
        {!ownsClinic && (
          <DropdownMenuItem onClick={() => setRegisterOpen(true)} className="gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BadgePlus className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Cadastrar minha clínica</p>
              <p className="text-[10px] text-muted-foreground">Você fica como dono</p>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <JoinClinicDialog open={joinOpen} onOpenChange={setJoinOpen} />
    <RegisterClinicDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </>
  );
}
