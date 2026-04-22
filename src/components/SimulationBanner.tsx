import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Clínica',
  dentist: 'Médico/Profissional',
  secretary: 'Secretária',
  patient: 'Paciente',
};

export function SimulationBanner() {
  const { isSimulating, simulatedRole, setSimulatedRole } = useAuth();

  if (!isSimulating || !simulatedRole) return null;

  const label = ROLE_LABELS[simulatedRole] ?? simulatedRole;

  return (
    <div className="w-full bg-yellow-500/90 text-black text-xs flex items-center justify-between px-4 h-7 z-[60]">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Modo simulação ativo — visualizando como <strong>{label}</strong>. RLS do banco continua usando sua conta real.
        </span>
      </div>
      <button
        onClick={() => setSimulatedRole(null)}
        className="flex items-center gap-1 font-medium hover:underline shrink-0"
      >
        <X className="h-3.5 w-3.5" />
        Sair da simulação
      </button>
    </div>
  );
}