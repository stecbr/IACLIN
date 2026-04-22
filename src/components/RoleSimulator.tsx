import { UserCog, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  const { canSimulate, loading, simulatedRole, setSimulatedRole, isSimulating } = useAuth();
  const navigate = useNavigate();

  if (loading || !canSimulate) return null;

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
          variant={isSimulating ? 'default' : 'ghost'}
          size="sm"
          className={
            isSimulating
              ? 'h-8 gap-1.5 bg-yellow-500 text-black hover:bg-yellow-500/90'
              : 'h-8 gap-1.5 text-muted-foreground hover:text-foreground'
          }
          title="Simular role (apenas dev/preview)"
        >
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">
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