import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CampaignData } from '../CampaignsWizard';

export default function Step1InfoCampaign({
  data,
  onChange,
}: {
  data: CampaignData;
  onChange: (data: Partial<CampaignData>) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Campaign Name */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="campaign-name" className="text-base font-semibold">
            Nome da campanha *
          </Label>
          <p className="text-sm text-muted-foreground">
            Um nome descritivo para organizar internamente. Seus pacientes não verão isso.
          </p>
        </div>
        <Input
          id="campaign-name"
          placeholder="Ex: Promoção de Clareamento - Julho"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="text-base"
        />
      </div>

      {/* Campaign Description */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="campaign-desc" className="text-base font-semibold">
            Descrição (opcional)
          </Label>
          <p className="text-sm text-muted-foreground">
            Notas internas sobre o objetivo da campanha.
          </p>
        </div>
        <Textarea
          id="campaign-desc"
          placeholder="Ex: Campanha de verão para aumentar agendamentos de clareamento"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
