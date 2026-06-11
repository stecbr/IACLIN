import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MemberProceduresEditor } from './MemberProceduresEditor';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicMemberId: string | null;
  clinicCategory: string | null;
  memberName?: string | null;
  onSaved?: () => void;
}

export function MemberProceduresDialog({ open, onOpenChange, clinicMemberId, clinicCategory, memberName, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Procedimentos de {memberName ?? 'profissional'}</DialogTitle>
          <DialogDescription>
            Marque os procedimentos que este profissional realiza nesta clínica. A IA usa essa lista para direcionar
            pacientes.
          </DialogDescription>
        </DialogHeader>
        {clinicMemberId && (
          <MemberProceduresEditor
            clinicMemberId={clinicMemberId}
            clinicCategory={clinicCategory}
            onSaved={() => {
              onSaved?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}