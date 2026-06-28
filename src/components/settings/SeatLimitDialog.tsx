import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  used?: number;
  limit?: number | null;
  planName?: string | null;
}

export function SeatLimitDialog({ open, onOpenChange, used, limit, planName }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Limite de profissionais atingido</DialogTitle>
          <DialogDescription className="text-center">
            {planName ? <>Seu plano <strong>{planName}</strong> permite</> : 'Seu plano permite'}
            {typeof limit === 'number' ? <> até <strong>{limit}</strong> profissionais</> : ' um número limitado de profissionais'}
            {typeof used === 'number' && typeof limit === 'number' ? <> ({used}/{limit} em uso)</> : null}
            . Para adicionar mais membros à sua equipe, faça upgrade do plano.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Agora não</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/settings?tab=subscription');
            }}
          >
            Ver planos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}