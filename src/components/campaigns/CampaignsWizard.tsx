import { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import Step1InfoCampaign from './steps/Step1InfoCampaign';
import Step2Audience from './steps/Step2Audience';
import Step3Message from './steps/Step3Message';
import Step4Channel from './steps/Step4Channel';
import Step5Review from './steps/Step5Review';

export interface CampaignData {
  name: string;
  description: string;
  audienceType: 'all' | 'active' | 'inactive' | 'scheduled' | 'absent' | 'birthday' | 'private' | 'insurance' | 'manual';
  filters: {
    procedures?: string[] | null;
    insurance_plan?: string | null;
    last_visit_days?: number | null;
  };
  messageType: 'template' | 'custom' | 'ai';
  templateId?: string;
  customMessage: string;
  channels: ('whatsapp' | 'sms')[];
  recipientCount: number;
  selectedPatients?: string[];
  /** destinatários resolvidos no Supabase (enviados prontos ao backend) */
  recipients?: { patient_id: string; phone: string; name: string }[];
}

const STEPS = [
  { number: 1, title: 'Informações', id: 'info' },
  { number: 2, title: 'Público', id: 'audience' },
  { number: 3, title: 'Mensagem', id: 'message' },
  { number: 4, title: 'Canal', id: 'channel' },
  { number: 5, title: 'Revisão', id: 'review' },
];

export default function CampaignsWizard({ clinicId, onComplete }: { clinicId: string; onComplete?: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    audienceType: 'all',
    filters: {},
    messageType: 'template',
    customMessage: '',
    channels: ['whatsapp'],
    recipientCount: 0,
  });

  const handleStepChange = (step: number) => {
    if (step >= 1 && step <= 5) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDataChange = (newData: Partial<CampaignData>) => {
    setCampaignData((prev) => ({
      ...prev,
      ...newData,
    }));
  };

  const canProceed = () => {
    if (currentStep === 1) return campaignData.name.trim().length > 0;
    if (currentStep === 2) return campaignData.recipientCount > 0;
    if (currentStep === 3) return campaignData.customMessage.trim().length > 0 || campaignData.messageType === 'template';
    if (currentStep === 4) return campaignData.channels.length > 0;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepChange(step.number)}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all',
                  currentStep === step.number
                    ? 'bg-blue-600 text-white shadow-lg'
                    : currentStep > step.number
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 cursor-not-allowed'
                )}
              >
                {currentStep > step.number ? '✓' : step.number}
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-1 mx-1 transition-all',
                    currentStep > step.number ? 'bg-green-100' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Title */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold">Etapa {currentStep}: {STEPS[currentStep - 1].title}</h2>
        <p className="text-sm text-muted-foreground">
          {currentStep === 1 && 'Informações básicas da sua campanha'}
          {currentStep === 2 && 'Defina quem vai receber a mensagem'}
          {currentStep === 3 && 'Crie ou escolha a mensagem a enviar'}
          {currentStep === 4 && 'Escolha o canal de comunicação'}
          {currentStep === 5 && 'Revise os detalhes antes de enviar'}
        </p>
      </div>

      {/* Card Container */}
      <Card className="max-w-2xl mx-auto shadow-sm">
        <CardContent className="pt-8">
          {/* Step 1 */}
          {currentStep === 1 && <Step1InfoCampaign data={campaignData} onChange={handleDataChange} />}

          {/* Step 2 */}
          {currentStep === 2 && (
            <Step2Audience clinicId={clinicId} data={campaignData} onChange={handleDataChange} />
          )}

          {/* Step 3 */}
          {currentStep === 3 && <Step3Message data={campaignData} onChange={handleDataChange} />}

          {/* Step 4 */}
          {currentStep === 4 && <Step4Channel data={campaignData} onChange={handleDataChange} />}

          {/* Step 5 */}
          {currentStep === 5 && (
            <Step5Review clinicId={clinicId} data={campaignData} onComplete={onComplete} />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3 max-w-2xl mx-auto">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        {currentStep < 5 && (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="gap-2 flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Próxima
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {currentStep === 5 && (
          <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
            <Sparkles className="w-4 h-4" />
            Enviar Agora
          </Button>
        )}
      </div>

      {/* Debug Info */}
      <div className="text-xs text-muted-foreground text-center">
        Step {currentStep} of {STEPS.length} • Recipients: {campaignData.recipientCount}
      </div>
    </div>
  );
}
