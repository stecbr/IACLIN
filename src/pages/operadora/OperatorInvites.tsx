import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Link as LinkIcon, Send } from 'lucide-react';

type InviteRecord = {
  id: string;
  createdAt: string;
  email: string;
  fullName: string;
  targetType: 'medico' | 'clinica';
  token: string;
  link: string;
  status: 'pending' | 'used' | 'revoked';
};

const storageKey = (operatorId: string) => `operator-invites:${operatorId}`;

export default function OperatorInvites() {
  const { operatorId } = useAuth();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [targetType, setTargetType] = useState<'medico' | 'clinica'>('medico');
  const [operatorName, setOperatorName] = useState('');
  const [records, setRecords] = useState<InviteRecord[]>([]);

  useEffect(() => {
    if (!operatorId) return;
    const raw = localStorage.getItem(storageKey(operatorId));
    if (raw) {
      try {
        setRecords(JSON.parse(raw) as InviteRecord[]);
      } catch {
        setRecords([]);
      }
    }

    supabase
      .from('insurance_operators')
      .select('name')
      .eq('id', operatorId)
      .maybeSingle()
      .then(({ data }) => setOperatorName(data?.name ?? 'Operadora'));
  }, [operatorId]);

  useEffect(() => {
    const name = searchParams.get('name');
    const email = searchParams.get('email');
    if (name) setFullName(name);
    if (email) setEmail(email);
  }, [searchParams]);

  const saveRecords = (next: InviteRecord[]) => {
    if (!operatorId) return;
    setRecords(next);
    localStorage.setItem(storageKey(operatorId), JSON.stringify(next));
  };

  const inviteLinkBase = useMemo(() => `${window.location.origin}/clinica/credenciamentos`, []);

  const createInvite = () => {
    if (!operatorId) return;
    if (!email.trim()) {
      toast.error('Informe o e-mail do convidado');
      return;
    }
    const token = crypto.randomUUID();
    const params = new URLSearchParams({
      cred_op: operatorId,
      invite: token,
      email: email.trim(),
    });
    const link = `${inviteLinkBase}?${params.toString()}`;

    const record: InviteRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      email: email.trim(),
      fullName: fullName.trim(),
      targetType,
      token,
      link,
      status: 'pending',
    };

    saveRecords([record, ...records]);
    setFullName('');
    setEmail('');
    setTargetType('medico');
    navigator.clipboard.writeText(link);
    toast.success('Convite criado e link copiado');
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado');
  };

  const revokeInvite = (id: string) => {
    const next = records.map((r) => (r.id === id ? { ...r, status: 'revoked' as const } : r));
    saveRecords(next);
    toast.success('Convite revogado');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Convites de credenciamento</h1>
          <p className="text-sm text-muted-foreground">
            Envie convites para clínicas e profissionais ingressarem na sua rede.
          </p>
        </div>
      </div>

      <Card className="rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <Label>Tipo</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as 'medico' | 'clinica')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medico">Médico / Dentista</SelectItem>
                <SelectItem value="clinica">Clínica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do convidado" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="convidado@email.com" />
          </div>
          <div className="flex items-end">
            <Button className="w-full rounded-xl" onClick={createInvite}>
              <Send className="h-4 w-4 mr-2" />
              Gerar convite
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O link abre o fluxo de credenciamento em "Clínica &gt; Credenciamentos". Esta versão salva o histórico de convites localmente no navegador da operadora.
        </p>
      </Card>

      {records.length === 0 ? (
        <Card className="rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
          <Send className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm font-medium">Nenhum convite enviado ainda</div>
          <p className="text-xs text-muted-foreground max-w-md">
            Gere um link único e envie por e-mail ou WhatsApp. O profissional preenche o dossiê e o pedido aparece em Pedidos.
          </p>
        </Card>
      ) : (
        <Card className="rounded-xl p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Convidado</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.fullName || r.email}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">{r.targetType === 'clinica' ? 'Clínica' : 'Médico/Dentista'}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[320px] truncate text-xs text-muted-foreground">{r.link}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.status === 'pending' ? 'border-amber-300 text-amber-700 bg-amber-50' : r.status === 'revoked' ? 'border-border text-muted-foreground bg-muted/30' : 'border-emerald-300 text-emerald-700 bg-emerald-50'}`}>
                        {r.status === 'pending' ? 'Pendente' : r.status === 'revoked' ? 'Revogado' : 'Usado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => copyLink(r.link)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                        </Button>
                        {r.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => revokeInvite(r.id)}>Revogar</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="rounded-xl p-4">
        <div className="text-sm font-medium flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Briefing do convite</div>
        <p className="text-xs text-muted-foreground mt-1">
          O convite informa que a operadora {operatorName || 'selecionada'} está aberta a novos credenciados e direciona o profissional para completar o dossiê com dados cadastrais, fotos e procedimentos desejados.
        </p>
      </Card>
    </div>
  );
}