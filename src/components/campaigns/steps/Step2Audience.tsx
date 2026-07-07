import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CampaignData } from '../CampaignsWizard';
import { useApi } from '@/hooks/useApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, Loader2 } from 'lucide-react';

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
  const { request } = useApi();
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [procedures] = useState<any[]>([
    { id: 'proc-1', name: 'Limpeza' },
    { id: 'proc-2', name: 'Clareamento' },
    { id: 'proc-3', name: 'Restauração' },
  ]);
  const [insurances] = useState<any[]>([
    { id: 'ins-1', name: 'Unimed' },
    { id: 'ins-2', name: 'Bradesco Saúde' },
    { id: 'ins-3', name: 'Amil' },
  ]);

  // Carregar dados auxiliares
  useEffect(() => {
    loadAuxiliaryData();
  }, [clinicId]);

  const loadAuxiliaryData = async () => {
    try {
      // Carregar profissionais
      // const profResp = await request(`/api/clinics/${clinicId}/professionals`);
      // setProfessionals(profResp.data || []);

      // Carregar especialidades
      // const specResp = await request(`/api/clinics/${clinicId}/specialties`);
      // setSpecialties(specResp.data || []);

      // Carregar procedimentos
      // const procResp = await request(`/api/clinics/${clinicId}/procedures`);
      // setProcedures(procResp.data || []);

      // Carregar convênios
      // const insResp = await request(`/api/clinics/${clinicId}/insurances`);
      // setInsurances(insResp.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  // Estimar contagem de pacientes pela API
  const estimateRecipients = async (audienceType: string, filters?: any) => {
    try {
      setLoading(true);
      const response = await request(
        `/api/clinics/${clinicId}/campaigns/estimate`,
        {
          method: 'POST',
          body: JSON.stringify({
            audience_type: audienceType,
            filters: filters || {},
          }),
        }
      );
      return response.data?.count || 0;
    } catch (err) {
      console.error('Erro ao estimar recipients:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const handleAudienceSelect = async (audienceType: string) => {
    const count = await estimateRecipients(audienceType);
    onChange({
      audienceType: audienceType as any,
      recipientCount: count,
      filters: {},
    });
    setShowFilters(true);
  };

  const handleFilterChange = async (filterKey: string, filterValue: any) => {
    const newFilters = { ...data.filters, [filterKey]: filterValue };
    const count = await estimateRecipients(data.audienceType, newFilters);
    onChange({
      filters: newFilters,
      recipientCount: count,
    });
  };

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
              onClick={() => handleAudienceSelect(option.id)}
              disabled={loading}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-all hover:border-blue-400 flex items-center gap-3 disabled:opacity-50',
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
      {loading ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <p className="font-semibold text-blue-900">Contando pacientes...</p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">
              {data.recipientCount > 0
                ? `${data.recipientCount} paciente${data.recipientCount !== 1 ? 's' : ''} será${data.recipientCount !== 1 ? 'ão' : 'á'} impactado${data.recipientCount !== 1 ? 's' : ''}`
                : 'Nenhum paciente encontrado'}
            </p>
            <p className="text-xs text-blue-700">Essa estimativa será atualizada conforme você adiciona filtros</p>
          </div>
        </div>
      )}

      {/* Additional Filters */}
      {showFilters && (
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base font-semibold">Filtros adicionais</Label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Procedure - Backend suporta */}
            <div className="space-y-2">
              <Label htmlFor="filter-proc" className="text-sm">
                Procedimento
              </Label>
              <Select
                value={data.filters.procedures?.join(',') || ''}
                onValueChange={(v) => handleFilterChange('procedures', v ? v.split(',') : null)}
              >
                <SelectTrigger id="filter-proc" disabled={loading}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {procedures.map((proc) => (
                    <SelectItem key={proc.id} value={proc.id}>
                      {proc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Insurance - Backend suporta */}
            <div className="space-y-2">
              <Label htmlFor="filter-insurance" className="text-sm">
                Convênio
              </Label>
              <Select
                value={data.filters.insurance_plan || ''}
                onValueChange={(v) => handleFilterChange('insurance_plan', v || null)}
              >
                <SelectTrigger id="filter-insurance" disabled={loading}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {insurances.map((ins) => (
                    <SelectItem key={ins.id} value={ins.id}>
                      {ins.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Last Consult */}
            {data.audienceType === 'absent' && (
              <div className="space-y-2">
                <Label htmlFor="filter-days" className="text-sm">
                  Últimos X meses
                </Label>
                <Input
                  id="filter-days"
                  type="number"
                  placeholder="Ex: 6"
                  min="1"
                  disabled={loading}
                  value={data.filters.lastConsultDays || ''}
                  onChange={(e) =>
                    handleFilterChange('lastConsultDays', parseInt(e.target.value) || 0)
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
