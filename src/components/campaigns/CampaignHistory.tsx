import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend } from '@/lib/aiBackend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react';
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

interface Recipient {
  id: string;
  name: string;
  phone: string;
  whatsapp_status: string | null;
  sms_status: string | null;
  sent_at: string | null;
}

interface ReplyInfo {
  replied: boolean;
  reply_count: number;
  last_reply_at: string | null;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [replies, setReplies] = useState<Record<string, ReplyInfo>>({});
  const [detailLoading, setDetailLoading] = useState(false);

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

  // Abre/fecha o detalhe de uma campanha: carrega destinatários (Supabase) e
  // cruza com quem respondeu (backend IA, que tem o histórico de conversas).
  const toggleExpand = async (campaign: Campaign) => {
    if (expanded === campaign.id) {
      setExpanded(null);
      return;
    }
    setExpanded(campaign.id);
    setRecipients([]);
    setReplies({});
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('id, name, phone, whatsapp_status, sms_status, sent_at')
        .eq('campaign_id', campaign.id)
        .order('name', { ascending: true });
      if (error) throw error;
      const recs = (data ?? []) as Recipient[];
      setRecipients(recs);

      // Quem respondeu — via backend IA (não bloqueia se falhar).
      try {
        const resp = await aiBackend.getCampaignReplies(
          clinicId,
          recs.map((r) => ({ phone: r.phone, sent_at: r.sent_at })),
        );
        setReplies((resp.data ?? {}) as Record<string, ReplyInfo>);
      } catch (e) {
        console.warn('Não foi possível carregar respostas:', e);
      }
    } catch (err) {
      console.error('Erro ao carregar destinatários:', err);
      toast({ title: 'Erro ao carregar destinatários', variant: 'destructive' });
    } finally {
      setDetailLoading(false);
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
    setSelected((s) => {
      const n = new Set(s);
      n.delete(campaignId);
      return n;
    });
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Apagar ${selected.size} campanha(s) do histórico?`)) return;
    const ids = [...selected];
    const { error } = await supabase.from('campaigns').delete().in('id', ids);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    setCampaigns((c) => c.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    toast({ title: `${ids.length} campanha(s) apagada(s)` });
  };

  const allChecked = campaigns.length > 0 && selected.size === campaigns.length;
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(campaigns.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Histórico de campanhas</CardTitle>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Excluir {selected.size} selecionada(s)
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Selecionar tudo" />
                </TableHead>
                <TableHead className="w-8" />
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
                <Fragment key={campaign.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(campaign.id)}
                        onCheckedChange={() => toggleOne(campaign.id)}
                        aria-label={`Selecionar ${campaign.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(campaign)}>
                        {expanded === campaign.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
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
                    <TableCell className="text-right font-semibold">{campaign.recipient_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {expanded === campaign.id && (
                    <TableRow>
                      <TableCell colSpan={9} className="bg-muted/30 p-0">
                        <div className="p-4">
                          {detailLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                              <Loader2 className="w-4 h-4 animate-spin" /> Carregando destinatários...
                            </div>
                          ) : recipients.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              Sem destinatários registrados para esta campanha.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead>Entrega</TableHead>
                                    <TableHead>Respondeu</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {recipients.map((r) => {
                                    const rep = replies[r.phone];
                                    const delivered = r.whatsapp_status === 'sent' || r.sms_status === 'sent';
                                    return (
                                      <TableRow key={r.id}>
                                        <TableCell className="font-medium">{r.name || '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{r.phone}</TableCell>
                                        <TableCell>
                                          <Badge
                                            variant="outline"
                                            className={delivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
                                          >
                                            {delivered ? 'Enviado' : (r.whatsapp_status ?? r.sms_status ?? 'pendente')}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {rep?.replied ? (
                                            <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                                              <Check className="w-4 h-4" /> Sim
                                              {rep.reply_count > 1 ? ` (${rep.reply_count})` : ''}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                                              <X className="w-4 h-4" /> Não
                                            </span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
