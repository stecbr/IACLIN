import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CampaignData } from '../CampaignsWizard';
import { supabase } from '@/integrations/supabase/client';
import {
  resolveCampaignAudience,
  type AudienceType,
  type AudienceFilters,
} from '@/hooks/useCampaignAudience';
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
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insurances, setInsurances] = useState<{ id: string; name: string }[]>([]);

  // Carrega os convênios REAIS presentes nos pacientes da clínica (Supabase),
  // em vez de uma lista fixa. Vira o dropdown de "Por convênio".
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('patients')
          .select('insurance_provider')
          .eq('clinic_id', clinicId)
          .not('insurance_provider', 'is', null)
          .limit(5000);
        if (error) throw error;
        const unique = Array.from(
          new Set((rows ?? []).map((r: { insurance_provider: string | null }) => r.insurance_provider).filter(Boolean) as string[]),
        ).sort();
        setInsurances(unique.map((name) => ({ id: name, name })));
      } catch (err) {
        console.error('Erro ao carregar convênios:', err);
        setInsurances([]);
      }
    })();
  }, [clinicId]);

  // Resolve o público na base real (Supabase) e guarda a lista pronta.
  const resolveAndStore = async (
    audienceType: AudienceType,
    filters: AudienceFilters,
  ) => {
    try {
      setLoading(true);
      const { recipients, count } = await resolveCampaignAudience(clinicId, audienceType, filters);
      onChange({ recipientCount: count, recipients });
      return count;
    } catch (err) {
      console.error('Erro ao resolver público:', err);
      onChange({ recipientCount: 0, recipients: [] });
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const handleAudienceSelect = async (audienceType: string) => {
    onChange({ audienceType: audienceType as AudienceType, filters: {} });
    setShowFilters(true);
    await resolveAndStore(audienceType as AudienceType, {});
  };

  const handleFilterChange = async (filterKey: string, filterValue: any) => {
    const newFilters = { ...data.filters, [filterKey]: filterValue };
    onChange({ filters: newFilters });
    // Traduz os filtros da UI para o shape do resolvedor e re-resolve na base real.
    const audienceFilters: AudienceFilters = {
      insurance_plan: newFilters.insurance_plan ?? data.filters.insurance_plan ?? null,
      last_visit_months: newFilters.last_visit_days ?? data.filters.last_visit_days ?? null,
    };
    await resolveAndStore(data.audienceType as AudienceType, audienceFilters);
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
            {/* Convênio — só faz sentido para o público "Por convênio" */}
            {data.audienceType === 'insurance' && (
              <div className="space-y-2">
                <Label htmlFor="filter-insurance" className="text-sm">
                  Convênio
                </Label>
                <Select
                  value={data.filters.insurance_plan || 'all'}
                  onValueChange={(v) => handleFilterChange('insurance_plan', v && v !== 'all' ? v : null)}
                >
                  <SelectTrigger id="filter-insurance" disabled={loading}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {insurances.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>
                        {ins.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  value={data.filters.last_visit_days || ''}
                  onChange={(e) =>
                    handleFilterChange('last_visit_days', parseInt(e.target.value) || 0)
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
