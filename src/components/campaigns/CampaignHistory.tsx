import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
  status: string;
  audience_type: string;
  channels: string[];
  recipient_count: number;
  created_at: string;
  sent_at: string | null;
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

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Ativos',
  inactive: 'Inativos',
  scheduled: 'Com consulta',
  absent: 'Sem retorno',
  birthday: 'Aniversariantes',
  private: 'Particulares',
  insurance: 'Convênio',
  manual: 'Manual',
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, [clinicId]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, status, audience_type, channels, recipient_count, created_at, sent_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setCampaigns((data ?? []) as Campaign[]);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!window.confirm('Apagar essa campanha do histórico?')) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    setCampaigns((c) => c.filter((x) => x.id !== campaignId));
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
          <p className="text-muted-foreground mb-2">Nenhuma campanha enviada ainda</p>
          <p className="text-sm text-muted-foreground">
            Configure o público e a mensagem acima e clique em "Enviar agora".
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
                <TableHead>Canais</TableHead>
                <TableHead className="text-right">Pacientes</TableHead>
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
                    {AUDIENCE_LABELS[campaign.audience_type] ?? campaign.audience_type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(campaign.channels ?? []).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {campaign.recipient_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
