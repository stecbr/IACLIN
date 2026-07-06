import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CampaignData } from '../CampaignsWizard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users } from 'lucide-react';

const AUDIENCE_OPTIONS = [
  { id: 'all', label: 'Todos os pacientes', icon: '👥' },
  { id: 'active', label: 'Pacientes ativos', icon: '✅' },
  { id: 'inactive', label: 'Pacientes inativos', icon: '⏸️' },
  { id: 'scheduled', label: 'Com consulta marcada', icon: '📅' },
  { id: 'absent', label: 'Sem consulta há X meses', icon: '⏰' },
  { id: 'birthday', label: 'Aniversariantes', icon: '🎂' },
  { id: 'private', label: 'Pacientes particulares', icon: '💳' },
  { id: 'insurance', label: 'Por convênio', icon: '🏥' },
  { id: 'manual', label: 'Seleção manual', icon: '🔍' },
];

export default function Step2Audience({
  clinicId,
  data,
  onChange,
}: {
  clinicId: string;
  data: CampaignData;
  onChange: (data: Partial<CampaignData>) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);

  // Simular contagem de pacientes (em produção virá da API)
  const estimateRecipients = () => {
    const baseCount: Record<string, number> = {
      all: 542,
      active: 437,
      inactive: 105,
      scheduled: 23,
      absent: 198,
      birthday: 12,
      private: 234,
      insurance: 308,
      manual: 0,
    };
    return baseCount[data.audienceType] || 0;
  };

  const currentCount = estimateRecipients();

  return (
    <div className="space-y-8">
      {/* Audience Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Quem deve receber essa campanha?</Label>
        <p className="text-sm text-muted-foreground">
          Escolha o grupo de pacientes. Filtros adicionais aparecerão conforme necessário.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {AUDIENCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange({ audienceType: option.id as any, recipientCount: estimateRecipients() });
                setShowFilters(true);
              }}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-all hover:border-blue-400 flex items-center gap-3',
                data.audienceType === option.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <span className="text-xl">{option.icon}</span>
              <span className="font-medium text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recipient Count */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
        <Users className="w-5 h-5 text-blue-600" />
        <div>
          <p className="font-semibold text-blue-900">
            {currentCount > 0 ? currentCount : 'Nenhum'} paciente{currentCount !== 1 ? 's' : ''} será{' '}
            {currentCount !== 1 ? '' : 'á'} impactado{currentCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-blue-700">Essa estimativa será atualizada conforme você adiciona filtros</p>
        </div>
      </div>

      {/* Additional Filters */}
      {showFilters && (
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base font-semibold">Filtros adicionais</Label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Professional */}
            <div className="space-y-2">
              <Label htmlFor="filter-prof" className="text-sm">
                Profissional
              </Label>
              <Select value={data.filters.professional || ''} onValueChange={(v) => onChange({ filters: { ...data.filters, professional: v } })}>
                <SelectTrigger id="filter-prof">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="dra-maria">Dra. Maria Silva</SelectItem>
                  <SelectItem value="dr-joao">Dr. João Costa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <Label htmlFor="filter-spec" className="text-sm">
                Especialidade
              </Label>
              <Select value={data.filters.specialty || ''} onValueChange={(v) => onChange({ filters: { ...data.filters, specialty: v } })}>
                <SelectTrigger id="filter-spec">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="dentistry">Odontologia</SelectItem>
                  <SelectItem value="orthodontics">Ortodontia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Procedure */}
            <div className="space-y-2">
              <Label htmlFor="filter-proc" className="text-sm">
                Procedimento
              </Label>
              <Select value={data.filters.procedure || ''} onValueChange={(v) => onChange({ filters: { ...data.filters, procedure: v } })}>
                <SelectTrigger id="filter-proc">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="cleaning">Limpeza</SelectItem>
                  <SelectItem value="whitening">Clareamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Insurance */}
            <div className="space-y-2">
              <Label htmlFor="filter-insurance" className="text-sm">
                Convênio
              </Label>
              <Select value={data.filters.insurance || ''} onValueChange={(v) => onChange({ filters: { ...data.filters, insurance: v } })}>
                <SelectTrigger id="filter-insurance">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="unimed">Unimed</SelectItem>
                  <SelectItem value="bradesco">Bradesco Saúde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Last Consult */}
            {data.audienceType === 'absent' && (
              <div className="space-y-2">
                <Label htmlFor="filter-days" className="text-sm">
                  Últimas X meses
                </Label>
                <Input
                  id="filter-days"
                  type="number"
                  placeholder="Ex: 6"
                  min="1"
                  value={data.filters.lastConsultDays || ''}
                  onChange={(e) =>
                    onChange({ filters: { ...data.filters, lastConsultDays: parseInt(e.target.value) || 0 } })
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
