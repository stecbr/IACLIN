import { MessageCircle, MessageSquare, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CampaignData } from '../CampaignsWizard';

const CHANNELS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Envie mensagens direto no WhatsApp do paciente',
    icon: MessageCircle,
    available: true,
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Envie mensagens de texto via SMS',
    icon: MessageSquare,
    available: false,
  },
];

export default function Step4Channel({
  data,
  onChange,
}: {
  data: CampaignData;
  onChange: (data: Partial<CampaignData>) => void;
}) {
  const handleChannelToggle = (channelId: string) => {
    let newChannels = [...data.channels];
    if (newChannels.includes(channelId as any)) {
      newChannels = newChannels.filter((c) => c !== channelId);
    } else {
      newChannels.push(channelId as any);
    }
    onChange({ channels: newChannels });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 mb-6">
        <Label className="text-base font-semibold">Escolha o canal de envio</Label>
        <p className="text-sm text-muted-foreground">
          Você pode selecionar múltiplos canais para aumentar o alcance da campanha.
        </p>
      </div>

      <div className="space-y-3">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          return (
            <Card
              key={channel.id}
              className={`p-4 cursor-pointer transition-all border-2 ${
                data.channels.includes(channel.id as any)
                  ? 'border-blue-600 bg-blue-50'
                  : channel.available
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
              onClick={() => channel.available && handleChannelToggle(channel.id)}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  {channel.available ? (
                    <Checkbox
                      checked={data.channels.includes(channel.id as any)}
                      onChange={() => handleChannelToggle(channel.id)}
                      disabled={!channel.available}
                    />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-5 h-5" />
                    <p className="font-semibold">{channel.name}</p>
                    {!channel.available && (
                      <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{channel.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>💡 Dica:</strong> WhatsApp tem melhor taxa de entrega e abertura. Use-o como seu canal principal.
        </p>
      </div>
    </div>
  );
}
