import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import CampaignForm from './CampaignForm';
import CampaignList from './CampaignList';
import './CampaignsPage.css';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  template: string;
  channels: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  stats: {
    total_recipients: number;
    sent_whatsapp: number;
    sent_sms: number;
    failed_whatsapp: number;
    failed_sms: number;
  };
  created_at: string;
}

interface CampaignsPageProps {
  clinicId: string;
}

export default function CampaignsPage({ clinicId }: CampaignsPageProps) {
  const { request } = useApi();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await request(`/api/clinics/${clinicId}/campaigns`);
      setCampaigns(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId) {
      loadCampaigns();
    }
  }, [clinicId]);

  const handleCreateOrUpdate = async () => {
    await loadCampaigns();
    setShowForm(false);
    setSelectedCampaign(null);
  };

  const handleDelete = async (campaignId: string) => {
    if (!window.confirm('Deletar campanha?')) return;

    try {
      await request(`/api/clinics/${clinicId}/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar');
    }
  };

  const handleSend = async (campaignId: string) => {
    if (!window.confirm('Enviar campanha para todos os recipients?')) return;

    try {
      setLoading(true);
      await request(`/api/clinics/${clinicId}/campaigns/${campaignId}/send`, {
        method: 'POST',
      });
      await loadCampaigns();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaigns-page">
      <div className="campaigns-header">
        <h1>📧 Campanhas</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nova Campanha'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <CampaignForm
          clinicId={clinicId}
          campaign={selectedCampaign || undefined}
          onSuccess={handleCreateOrUpdate}
        />
      )}

      {loading && <div className="spinner">Carregando...</div>}

      <CampaignList
        campaigns={campaigns}
        onDelete={handleDelete}
        onSend={handleSend}
        onEdit={(campaign) => {
          setSelectedCampaign(campaign);
          setShowForm(true);
        }}
      />
    </div>
  );
}
