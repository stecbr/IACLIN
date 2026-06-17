import { useState } from 'react';
import { Stethoscope, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewMode } from '@/hooks/useViewMode';
import { FirstConsultModeDialog } from '@/components/FirstConsultModeDialog';
import { toast } from 'sonner';

interface Props {
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Toggle that lets a clinic owner / admin switch between "Modo Gestor"
 * (clinic dashboard) and "Modo Consulta" (professional dashboard).
 */
export function ViewModeToggle({ variant = 'default', className }: Props) {
  const { viewMode, canSwitch, hasProfessionalProfile, setViewMode } = useViewMode();
  const [askProfile, setAskProfile] = useState(false);

  if (!canSwitch) return null;

  const isManager = viewMode === 'manager';
  const label = isManager ? 'Modo Consulta' : 'Modo Gestor';
  const Icon = isManager ? Stethoscope : Building2;

  const handleClick = () => {
    if (isManager && !hasProfessionalProfile) {
      setAskProfile(true);
      return;
    }
    setViewMode(isManager ? 'consult' : 'manager');
    toast.success(isManager ? 'Modo consulta ativado' : 'Modo gestor ativado');
  };

  return (
    <>
      <Button
        type="button"
        variant={isManager ? 'default' : 'outline'}
        size={variant === 'compact' ? 'sm' : 'default'}
        onClick={handleClick}
        className={className}
      >
        <Icon className="h-4 w-4" />
        <span className={variant === 'compact' ? 'text-xs' : ''}>{label}</span>
      </Button>

      <FirstConsultModeDialog
        open={askProfile}
        onOpenChange={setAskProfile}
        onSaved={() => {
          setViewMode('consult');
          toast.success('Modo consulta ativado');
        }}
      />
    </>
  );
}