import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OperatorSettings() {
  const { operatorId } = useAuth();
  const [op, setOp] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!operatorId) return;
    supabase.from('insurance_operators').select('*').eq('id', operatorId).single()
      .then(({ data }) => setOp(data));
  }, [operatorId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('insurance_operators').update({
      name: op.name, legal_name: op.legal_name, cnpj: op.cnpj, ans_code: op.ans_code,
      type: op.type, brand_color: op.brand_color, contact_email: op.contact_email,
      contact_phone: op.contact_phone, responsible_name: op.responsible_name,
    }).eq('id', operatorId);
    setSaving(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Salvo');
  };

  if (!op) return <Card className="p-8 text-sm text-muted-foreground">Carregando...</Card>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da sua operadora</p>
      </div>
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Nome fantasia</Label><Input value={op.name ?? ''} onChange={(e) => setOp({ ...op, name: e.target.value })} /></div>
          <div><Label>Razão social</Label><Input value={op.legal_name ?? ''} onChange={(e) => setOp({ ...op, legal_name: e.target.value })} /></div>
          <div><Label>CNPJ</Label><Input value={op.cnpj ?? ''} onChange={(e) => setOp({ ...op, cnpj: e.target.value })} /></div>
          <div><Label>Código ANS</Label><Input value={op.ans_code ?? ''} onChange={(e) => setOp({ ...op, ans_code: e.target.value })} /></div>
          <div>
            <Label>Tipo</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={op.type} onChange={(e) => setOp({ ...op, type: e.target.value })}>
              <option value="medico">Médica</option>
              <option value="odonto">Odontológica</option>
              <option value="ambos">Médica e odontológica</option>
            </select>
          </div>
          <div><Label>Cor da marca</Label><Input type="color" value={op.brand_color ?? '#3B82F6'} onChange={(e) => setOp({ ...op, brand_color: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input value={op.contact_email ?? ''} onChange={(e) => setOp({ ...op, contact_email: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={op.contact_phone ?? ''} onChange={(e) => setOp({ ...op, contact_phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Responsável</Label><Input value={op.responsible_name ?? ''} onChange={(e) => setOp({ ...op, responsible_name: e.target.value })} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button></div>
      </Card>
    </div>
  );
}