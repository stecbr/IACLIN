import { UserCog, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { isDevEnvironment } from '@/lib/isDevEnvironment';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppRole = 'admin' | 'dentist' | 'secretary' | 'patient';

const SIMULATABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Clínica' },
  { value: 'dentist', label: 'Médico/Profissional' },
  { value: 'patient', label: 'Paciente' },
];

export function RoleSimulator() {
  const { canSimulate, simulatedRole, setSimulatedRole, isSimulating, user } = useAuth();
  const navigate = useNavigate();

  // Dev/preview only — never render in production hosts.
  // We deliberately do NOT gate on `loading` so the button shows up as soon as
  // the layout mounts, and we only require the user to be authenticated.
  if (!isDevEnvironment()) return null;
  if (!user) return null;
  if (!canSimulate) return null;

  const currentLabel = simulatedRole
    ? SIMULATABLE_ROLES.find((r) => r.value === simulatedRole)?.label ?? simulatedRole
    : null;

  const handleSelect = (role: AppRole | null) => {
    setSimulatedRole(role);
    navigate('/', { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className={
            isSimulating
              ? 'h-8 gap-1.5 bg-yellow-500 text-black hover:bg-yellow-500/90 border border-yellow-600'
              : 'h-8 gap-1.5 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/25 border border-yellow-500/40'
          }
          title="Simular role (apenas dev/preview)"
        >
          <UserCog className="h-4 w-4" />
          <span className="text-xs font-medium">
            {isSimulating ? `Simulando: ${currentLabel}` : 'Visualizar como'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Simulação de role (dev)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!isSimulating}
          onClick={() => handleSelect(null)}
        >
          {!isSimulating && <Check className="h-4 w-4 mr-2" />}
          <span className={!isSimulating ? '' : 'ml-6'}>Conta real</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {SIMULATABLE_ROLES.map((r) => {
          const active = simulatedRole === r.value;
          return (
            <DropdownMenuItem key={r.value} onClick={() => handleSelect(r.value)}>
              {active ? <Check className="h-4 w-4 mr-2" /> : <span className="w-4 mr-2" />}
              {r.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}