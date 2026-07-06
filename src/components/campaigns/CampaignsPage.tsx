import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Copy, X } from 'lucide-react';
import CampaignsWizard from './CampaignsWizard';
import CampaignHistory from './CampaignHistory';

export default function CampaignsPage({ clinicId }: { clinicId: string }) {
  const [activeTab, setActiveTab] = useState('create');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      // API call here
      setCampaigns([]);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [clinicId]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
        <p className="text-muted-foreground">
          Envie mensagens em massa via WhatsApp e mantenha seus pacientes sempre informados.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none gap-2">
          <TabsTrigger value="create" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </TabsTrigger>
          <TabsTrigger value="history">
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Create Tab */}
        <TabsContent value="create" className="py-6">
          <CampaignsWizard clinicId={clinicId} onComplete={() => setActiveTab('history')} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="py-6">
          <CampaignHistory clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
