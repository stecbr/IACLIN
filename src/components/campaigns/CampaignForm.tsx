import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import './CampaignForm.css';

interface Campaign {
  id?: string;
  name: string;
  description?: string;
  template: string;
  channels: string[];
  filters: {
    patient_type: 'all' | 'returning' | 'new';
    last_visit_days?: number | null;
    procedures?: string[] | null;
    insurance_plan?: string | null;
  };
}

interface CampaignFormProps {
  clinicId: string;
  campaign?: Campaign;
  onSuccess: () => void;
}

export default function CampaignForm({ clinicId, campaign, onSuccess }: CampaignFormProps) {
  const { request } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<any>(null);
  const [form, setForm] = useState<Campaign>(
    campaign || {
      name: '',
      description: '',
      template: 'Olá {patient_name}!',
      channels: ['whatsapp'],
      filters: {
        patient_type: 'all',
        last_visit_days: null,
        procedures: null,
        insurance_plan: null,
      },
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [name]: value || null,
      },
    }));
  };

  const handleChannelToggle = (channel: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError(null);

      if (campaign?.id) {
        await request(`/api/clinics/${clinicId}/campaigns/${campaign.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });

        const preview = await request(
          `/api/clinics/${clinicId}/campaigns/${campaign.id}/preview`,
          {
            method: 'POST',
          }
        );
        setRecipients(preview.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const method = campaign?.id ? 'PATCH' : 'POST';
      const url = campaign?.id
        ? `/api/clinics/${clinicId}/campaigns/${campaign.id}`
        : `/api/clinics/${clinicId}/campaigns`;

      await request(url, {
        method,
        body: JSON.stringify(form),
      });

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaign-form">
      <h2>{campaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome *</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ex: Promoção Clareamento"
            required
          />
        </div>

        <div className="form-group">
          <label>Descrição</label>
          <input
            type="text"
            name="description"
            value={form.description || ''}
            onChange={handleChange}
            placeholder="Descrição interna"
          />
        </div>

        <div className="form-group">
          <label>Mensagem *</label>
          <textarea
            name="template"
            value={form.template}
            onChange={handleChange}
            placeholder="Use {patient_name} para inserir o nome do paciente"
            rows={4}
            required
          />
          <small>Variáveis disponíveis: {`{patient_name}`}</small>
        </div>

        <div className="form-group">
          <label>Canais</label>
          <div className="channels">
            <label>
              <input
                type="checkbox"
                checked={form.channels.includes('whatsapp')}
                onChange={() => handleChannelToggle('whatsapp')}
              />
              WhatsApp
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.channels.includes('sms')}
                onChange={() => handleChannelToggle('sms')}
              />
              SMS
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3>Filtros de Segmentação</h3>

          <div className="form-group">
            <label>Tipo de Paciente</label>
            <select
              name="patient_type"
              value={form.filters.patient_type}
              onChange={handleFilterChange}
            >
              <option value="all">Todos</option>
              <option value="returning">Retornando</option>
              <option value="new">Novos</option>
            </select>
          </div>

          <div className="form-group">
            <label>Últimas X dias</label>
            <input
              type="number"
              name="last_visit_days"
              value={form.filters.last_visit_days || ''}
              onChange={handleFilterChange}
              placeholder="Ex: 90"
            />
          </div>

          <div className="form-group">
            <label>Procedimentos (separados por vírgula)</label>
            <input
              type="text"
              name="procedures"
              value={form.filters.procedures?.join(',') || ''}
              onChange={handleFilterChange}
              placeholder="Ex: limpeza,clareamento"
            />
          </div>

          <div className="form-group">
            <label>Plano de Saúde</label>
            <input
              type="text"
              name="insurance_plan"
              value={form.filters.insurance_plan || ''}
              onChange={handleFilterChange}
              placeholder="Ex: Bradesco"
            />
          </div>
        </div>

        {recipients && (
          <div className="preview">
            <h3>Preview</h3>
            <p>
              <strong>Recipients:</strong> {recipients.total_recipients}
            </p>
            {recipients.sample_recipients?.length > 0 && (
              <div>
                <strong>Amostra:</strong>
                <ul>
                  {recipients.sample_recipients.map((r: any) => (
                    <li key={r.patient_id}>
                      {r.name} ({r.phone})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
            👁️ Preview
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
