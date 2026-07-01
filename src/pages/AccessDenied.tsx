import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AccessDenied = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-5">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Sem permissão</h1>
        <p className="text-muted-foreground text-sm mb-1">
          Você não tem acesso à página{' '}
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {location.pathname}
          </span>
        </p>
        <p className="text-muted-foreground text-sm mb-6">
          Fale com o administrador da clínica se precisar de acesso.
        </p>
        <Button onClick={() => navigate('/app', { replace: true })} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default AccessDenied;
