import { FlaskConical, Building2, Stethoscope, User as UserIcon, Undo2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimulatedRole } from '@/lib/devAccess';

const ROLE_LABELS: Record<SimulatedRole, { label: string; icon: typeof Building2 }> = {
  admin: { label: 'Clínica (admin)', icon: Building2 },
  dentist: { label: 'Médico (dentist)', icon: Stethoscope },
  patient: { label: 'Paciente', icon: UserIcon },
};

export function DevRoleSwitcher() {
  const { isDevUser, simulatedRole, setSimulatedRole } = useAuth();
  const navigate = useNavigate();

  if (!isDevUser) return null;

  const currentLabel = simulatedRole ? ROLE_LABELS[simulatedRole].label : 'Modo dev';
  const isSimulating = simulatedRole !== null;

  const handleSelect = (role: SimulatedRole) => {
    setSimulatedRole(role);
    if (role === 'patient') navigate('/paciente');
    else navigate('/');
  };

  const handleReset = () => {
    setSimulatedRole(null);
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            isSimulating
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70'
          }`}
          title="Modo desenvolvedor"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">
            {isSimulating ? `Vendo como: ${currentLabel}` : 'Modo dev'}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Modo desenvolvedor
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(ROLE_LABELS) as SimulatedRole[]).map((role) => {
          const { label, icon: Icon } = ROLE_LABELS[role];
          const active = simulatedRole === role;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => handleSelect(role)}
              className="gap-2 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{label}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleReset}
          disabled={!isSimulating}
          className="gap-2 cursor-pointer text-muted-foreground"
        >
          <Undo2 className="h-4 w-4" />
          <span className="text-sm">Voltar ao normal</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}