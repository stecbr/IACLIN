import './CampaignList.css';

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

interface CampaignListProps {
  campaigns: Campaign[];
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  onEdit: (campaign: Campaign) => void;
}

export default function CampaignList({ campaigns, onDelete, onSend, onEdit }: CampaignListProps) {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'badge-info',
      scheduled: 'badge-warning',
      sending: 'badge-primary',
      completed: 'badge-success',
      failed: 'badge-danger',
    };
    return colors[status] || 'badge-secondary';
  };

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhuma campanha criada ainda</p>
      </div>
    );
  }

  return (
    <div className="campaigns-list">
      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Canais</th>
            <th>Recipients</th>
            <th>Enviados</th>
            <th>Falhas</th>
            <th>Criada em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>
                <strong>{campaign.name}</strong>
                {campaign.description && <p className="text-muted">{campaign.description}</p>}
              </td>
              <td>
                <span className={`badge ${getStatusBadge(campaign.status)}`}>
                  {campaign.status}
                </span>
              </td>
              <td>
                <div className="channels-badge">
                  {campaign.channels.includes('whatsapp') && <span>📱 WA</span>}
                  {campaign.channels.includes('sms') && <span>📲 SMS</span>}
                </div>
              </td>
              <td>{campaign.stats?.total_recipients || 0}</td>
              <td>
                {campaign.stats?.sent_whatsapp || 0} +{campaign.stats?.sent_sms || 0}
              </td>
              <td className="text-danger">
                {campaign.stats?.failed_whatsapp || 0} +{campaign.stats?.failed_sms || 0}
              </td>
              <td className="text-muted">
                {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
              </td>
              <td>
                <div className="actions">
                  {campaign.status === 'draft' && (
                    <>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => onEdit(campaign)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onDelete(campaign.id)}
                        title="Deletar"
                      >
                        🗑️
                      </button>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => onSend(campaign.id)}
                        title="Enviar"
                      >
                        🚀
                      </button>
                    </>
                  )}
                  {campaign.status !== 'draft' && (
                    <span className="text-muted">Enviada</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
