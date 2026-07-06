import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clock, Send, BookmarkPlus } from 'lucide-react';
import { CampaignData } from '../CampaignsWizard';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';

export default function Step5Review({
  clinicId,
  data,
  onComplete,
}: {
  clinicId: string;
  data: CampaignData;
  onComplete?: () => void;
}) {
  const { request } = useApi();
  const [sending, setSending] = useState(false);

  const handleSendNow = async () => {
    try {
      setSending(true);
      await request(`/api/clinics/${clinicId}/campaigns`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          template: data.customMessage,
          channels: data.channels,
          filters: data.filters,
          status: 'sending',
        }),
      });
      toast.success('Campanha enviada com sucesso!');
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setSending(true);
      await request(`/api/clinics/${clinicId}/campaigns`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          template: data.customMessage,
          channels: data.channels,
          filters: data.filters,
          status: 'draft',
        }),
      });
      toast.success('Campanha salva como rascunho!');
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="preview">Prévia da mensagem</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{data.name}</span>
              </div>
              {data.description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="font-medium">{data.description}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Público</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge variant="outline">{data.audienceType}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pacientes:</span>
                <span className="font-semibold text-lg text-blue-600">{data.recipientCount}</span>
              </div>
              {Object.keys(data.filters).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground mb-2">Filtros aplicados:</p>
                  <div className="space-y-1">
                    {Object.entries(data.filters).map(([key, value]) => (
                      <p key={key} className="text-xs">
                        • <span className="capitalize">{key}:</span> {String(value)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Canais</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {data.channels.map((channel) => (
                <Badge key={channel} variant="secondary">
                  {channel === 'whatsapp' ? '📱 WhatsApp' : '📲 SMS'}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Como o paciente receberá</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="bg-white rounded-lg shadow-sm p-4 max-w-sm mx-auto">
                  <div className="text-xs text-gray-500 mb-2 font-semibold">WhatsApp</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {data.customMessage || '[Mensagem vazia]'}
                  </div>
                  <div className="text-xs text-gray-500 mt-3 text-right">
                    {new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warning Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          <strong>⚠️ Atenção:</strong> Você está prestes a enviar uma mensagem para{' '}
          <strong>{data.recipientCount} paciente(s)</strong>. Esta ação não pode ser desfeita.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse md:flex-row gap-3 pt-4">
        <Button variant="outline" onClick={handleSaveDraft} disabled={sending} className="gap-2">
          <BookmarkPlus className="w-4 h-4" />
          Salvar rascunho
        </Button>

        <Button variant="outline" disabled={sending} className="gap-2">
          <Clock className="w-4 h-4" />
          Agendar envio
        </Button>

        <Button
          onClick={handleSendNow}
          disabled={sending}
          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
        >
          {sending ? (
            <>Enviando...</>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar agora
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Você receberá um relatório detalhado após o envio.
      </p>
    </div>
  );
}
