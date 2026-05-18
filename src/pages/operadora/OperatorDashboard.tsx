import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function OperatorDashboard() {
  const { operatorId } = useAuth();
  const [stats, setStats] = useState({ approved: 0, pending: 0, rejected: 0, clinics: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId) return;
    (async () => {
      const { data } = await supabase
        .from('operator_credentialings')
        .select('status, clinic_id')
        .eq('operator_id', operatorId);
      const rows = data ?? [];
      const approved = rows.filter((r) => r.status === 'approved').length;
      const pending = rows.filter((r) => r.status === 'pending').length;
      const rejected = rows.filter((r) => r.status === 'rejected').length;
      const clinics = new Set(rows.filter((r) => r.status === 'approved').map((r) => r.clinic_id)).size;
      setStats({ approved, pending, rejected, clinics });
      setLoading(false);
    })();
  }, [operatorId]);

  const kpis = [
    { label: 'Profissionais credenciados', value: stats.approved, icon: Users, color: 'text-green-600' },
    { label: 'Pedidos pendentes', value: stats.pending, icon: Clock, color: 'text-amber-600' },
    { label: 'Clínicas na rede', value: stats.clinics, icon: CheckCircle2, color: 'text-blue-600' },
    { label: 'Recusados', value: stats.rejected, icon: XCircle, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Resumo da sua rede credenciada</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <div className="text-2xl font-semibold">{loading ? '—' : k.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Use o menu lateral para gerenciar pedidos de credenciamento, visualizar a rede e consultar agenda dos profissionais.
        </p>
      </Card>
    </div>
  );
}