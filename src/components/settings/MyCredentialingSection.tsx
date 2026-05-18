import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Building2, Check, X, Clock, Ban, Search } from 'lucide-react';

type Operator = {
  id: string;
  name: string;
  ans_code: string | null;
  type: string;
  brand_color: string | null;
  logo_url: string | null;
};

type Credentialing = {
  id: string;
  operator_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  rejection_reason: string | null;
};

const statusMap: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: 'Pendente', icon: Clock, cls: 'bg-warning/15 text-warning border-warning/30' },
  approved: { label: 'Credenciado', icon: Check, cls: 'bg-success/15 text-success border-success/30' },
  rejected: { label: 'Recusado', icon: X, cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  revoked: { label: 'Revogado', icon: Ban, cls: 'bg-muted text-muted-foreground border-border' },
};

export default function MyCredentialingSection() {
  const { user, currentClinicId } = useAuth();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [creds, setCreds] = useState<Credentialing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyOp, setBusyOp] = useState<string | null>(null);

  const load = async () => {
    if (!user || !currentClinicId) return;
    setLoading(true);
    const { data: member } = await supabase
      .from('clinic_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('clinic_id', currentClinicId)
      .maybeSingle();
    const mId = (member as any)?.id ?? null;
    setMemberId(mId);

    const [{ data: ops }, { data: cds }] = await Promise.all([
      supabase.from('insurance_operators').select('id, name, ans_code, type, brand_color, logo_url').eq('is_active', true).order('name'),
      mId
        ? supabase.from('operator_credentialings').select('id, operator_id, status, rejection_reason').eq('clinic_member_id', mId)
        : Promise.resolve({ data: [] } as any),
    ]);
    setOperators((ops as any) ?? []);
    setCreds((cds as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, currentClinicId]);

  const byOp = useMemo(() => {
    const map = new Map<string, Credentialing>();
    creds.forEach((c) => map.set(c.operator_id, c));
    return map;
  }, [creds]);

  const filtered = operators.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  const request = async (op: Operator) => {
    if (!user || !currentClinicId || !memberId) return;
    setBusyOp(op.id);
    const { error } = await supabase.from('operator_credentialings').insert({
      operator_id: op.id,
      clinic_id: currentClinicId,
      clinic_member_id: memberId,
      professional_user_id: user.id,
      requested_by: user.id,
      status: 'pending',
    } as any);
    setBusyOp(null);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success(`Pedido enviado para ${op.name}`);
    load();
  };

  const cancel = async (cred: Credentialing, opName: string) => {
    setBusyOp(cred.operator_id);
    const { error } = await supabase.from('operator_credentialings').delete().eq('id', cred.id);
    setBusyOp(null);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success(`Pedido com ${opName} cancelado`);
    load();
  };

  if (!currentClinicId) {
    return (
      <Card><CardContent className="p-8 text-sm text-muted-foreground">Selecione uma clínica para gerenciar credenciamentos.</CardContent></Card>
    );
  }

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Convênios aceitos</CardTitle>
        <CardDescription>
          Solicite credenciamento junto às operadoras. Após aprovação, você aparece para pacientes desses planos no marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar operadora..." className="pl-9" />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma operadora encontrada.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((op) => {
              const cred = byOp.get(op.id);
              const st = cred ? statusMap[cred.status] : null;
              const Icon = st?.icon;
              return (
                <div key={op.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <div
                    className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (op.brand_color ?? '#6B7280') + '20', color: op.brand_color ?? '#6B7280' }}
                  >
                    {op.logo_url ? <img src={op.logo_url} alt={op.name} className="h-7 w-7 object-contain" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{op.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {op.ans_code ? `ANS ${op.ans_code}` : 'Sem código ANS'} · {op.type === 'medico' ? 'Médica' : op.type === 'odonto' ? 'Odontológica' : 'Médica e odontológica'}
                    </p>
                    {cred?.status === 'rejected' && cred.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">Motivo: {cred.rejection_reason}</p>
                    )}
                  </div>
                  {st && Icon && (
                    <Badge variant="outline" className={`gap-1 ${st.cls}`}>
                      <Icon className="h-3 w-3" /> {st.label}
                    </Badge>
                  )}
                  {!cred && (
                    <Button size="sm" variant="outline" disabled={busyOp === op.id || !memberId} onClick={() => request(op)}>
                      Solicitar
                    </Button>
                  )}
                  {cred?.status === 'pending' && (
                    <Button size="sm" variant="ghost" disabled={busyOp === op.id} onClick={() => cancel(cred, op.name)}>
                      Cancelar
                    </Button>
                  )}
                  {(cred?.status === 'rejected' || cred?.status === 'revoked') && (
                    <Button size="sm" variant="outline" disabled={busyOp === op.id} onClick={() => { cancel(cred, op.name).then(() => request(op)); }}>
                      Solicitar novamente
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}