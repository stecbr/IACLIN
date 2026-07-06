import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Copy, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  audienceType: string;
  recipientCount: number;
  sentWhatsapp: number;
  sentSms: number;
  failedWhatsapp: number;
  failedSms: number;
  createdAt: string;
  executedAt?: string;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'sending':
      return 'bg-yellow-100 text-yellow-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'scheduled':
      return 'Agendada';
    case 'sending':
      return 'Enviando';
    case 'completed':
      return 'Enviada';
    case 'failed':
      return 'Falha';
    default:
      return status;
  }
};

export default function CampaignHistory({ clinicId }: { clinicId: string }) {
  const { request } = useApi();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, [clinicId]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await request(`/api/clinics/${clinicId}/campaigns`);
      setCampaigns(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = (campaign: Campaign) => {
    console.log('Duplicar campanha:', campaign.id);
  };

  const handleDelete = (campaignId: string) => {
    if (window.confirm('Deletar essa campanha?')) {
      console.log('Deletar:', campaignId);
    }
  };

  const handleView = (campaign: Campaign) => {
    console.log('Ver detalhes:', campaign.id);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Carregando campanhas...</p>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-2">Nenhuma campanha criada ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie sua primeira campanha na aba "Nova Campanha"
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de campanhas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Público</TableHead>
                <TableHead className="text-right">Pacientes</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadgeClass(campaign.status)}>
                      {getStatusLabel(campaign.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {campaign.audienceType}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {campaign.recipientCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.sentWhatsapp + campaign.sentSms}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.failedWhatsapp + campaign.failedSms > 0 && (
                      <span className="text-red-600 font-semibold">
                        {campaign.failedWhatsapp + campaign.failedSms}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleView(campaign)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {campaign.status === 'draft' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDuplicate(campaign)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(campaign.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
