import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Plus } from 'lucide-react';
import { CampaignData } from '../CampaignsWizard';

const TEMPLATES = [
  {
    id: 'promo',
    name: 'Promoção',
    preview: 'Olá! Aproveite nossa promoção especial de 20% em todos os serviços.',
  },
  {
    id: 'reminder',
    name: 'Lembrete',
    preview: 'Não se esqueça! Sua consulta está marcada para amanhã às 14h.',
  },
  {
    id: 'return',
    name: 'Retorno',
    preview: 'Saudade de você! Já faz tempo que não se vê por aqui.',
  },
  {
    id: 'appointment',
    name: 'Confirmação',
    preview: 'Sua consulta foi confirmada para 05/07 às 10:30 com Dra. Maria.',
  },
  {
    id: 'birthday',
    name: 'Aniversário',
    preview: 'Parabéns pelo seu aniversário! Aproveite 15% de desconto em nossos serviços.',
  },
  {
    id: 'nps',
    name: 'Pesquisa',
    preview: 'Como foi sua experiência? Nos ajude a melhorar respondendo esta pesquisa.',
  },
];

const DYNAMIC_FIELDS = [
  { id: 'patient_name', label: 'Nome do paciente' },
  { id: 'professional_name', label: 'Nome do profissional' },
  { id: 'appointment_date', label: 'Data da consulta' },
  { id: 'appointment_time', label: 'Horário da consulta' },
  { id: 'clinic_name', label: 'Nome da clínica' },
  { id: 'clinic_address', label: 'Endereço da clínica' },
  { id: 'clinic_phone', label: 'Telefone da clínica' },
  { id: 'insurance', label: 'Convênio' },
  { id: 'procedure', label: 'Procedimento' },
];

export default function Step3Message({
  data,
  onChange,
}: {
  data: CampaignData;
  onChange: (data: Partial<CampaignData>) => void;
}) {
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiObjective, setAiObjective] = useState('');

  const handleInsertField = (fieldId: string) => {
    const field = DYNAMIC_FIELDS.find((f) => f.id === fieldId);
    if (field) {
      const newMessage = data.customMessage + ` [${field.label}]`;
      onChange({ customMessage: newMessage });
    }
  };

  const handleAiGenerate = () => {
    // Simulação: em produção, chamaria a API de IA
    const aiMessage = `Olá [Nome do paciente]!\n\n${aiObjective}\n\nNos vemos em breve!\n\nAtenciosamente,\n[Nome da clínica]`;
    onChange({ customMessage: aiMessage, messageType: 'ai' });
    setShowAiDialog(false);
    setAiObjective('');
  };

  // Simular preview da mensagem
  const getPreview = () => {
    let preview = data.customMessage;
    preview = preview.replace(/\[Nome do paciente\]/g, 'João Silva');
    preview = preview.replace(/\[Nome do profissional\]/g, 'Dra. Maria');
    preview = preview.replace(/\[Data da consulta\]/g, '15/07/2024');
    preview = preview.replace(/\[Horário da consulta\]/g, '14:30');
    preview = preview.replace(/\[Nome da clínica\]/g, 'Clínica Exemplo');
    return preview;
  };

  return (
    <div className="space-y-6">
      <Tabs value={data.messageType} onValueChange={(v) => onChange({ messageType: v as any })}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template">Usar modelo</TabsTrigger>
          <TabsTrigger value="custom">Criar mensagem</TabsTrigger>
        </TabsList>

        {/* Template Selection */}
        <TabsContent value="template" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => onChange({ templateId: template.id, messageType: 'template' })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  data.templateId === template.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm mb-1">{template.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{template.preview}</p>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Custom Message */}
        <TabsContent value="custom" className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="message" className="text-base font-semibold">
                Escreva sua mensagem
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiDialog(true)}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Escrever com IA
              </Button>
            </div>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui. Use 'Inserir informação' para adicionar dados dinâmicos."
              value={data.customMessage}
              onChange={(e) => onChange({ customMessage: e.target.value })}
              rows={6}
              className="resize-none"
            />

            {/* Insert Dynamic Field Button */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-muted-foreground self-center">
                Inserir informação:
              </span>
              <Select onValueChange={handleInsertField}>
                <SelectTrigger className="w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {DYNAMIC_FIELDS.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {data.customMessage && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-muted-foreground mb-2">COMO O PACIENTE RECEBERÁ:</p>
              <div className="bg-white p-4 rounded border border-gray-200 text-sm whitespace-pre-wrap">
                {getPreview()}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Gerar mensagem com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o objetivo da sua campanha e a IA criará uma mensagem profissional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-objective">Qual é o objetivo da campanha?</Label>
              <Textarea
                id="ai-objective"
                placeholder="Ex: Quero divulgar uma promoção de clareamento dental para pacientes que não retornam há 6 meses"
                value={aiObjective}
                onChange={(e) => setAiObjective(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAiDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAiGenerate} disabled={!aiObjective.trim()} className="flex-1">
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar com IA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
