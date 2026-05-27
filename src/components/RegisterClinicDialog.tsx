import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Loader2, Search, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RegisterClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function RegisterClinicDialog({ open, onOpenChange }: RegisterClinicDialogProps) {
  const [cnpj, setCnpj] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>('odonto');
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCnpj(''); setLegalName(''); setTradeName(''); setResponsibleName('');
      setPhone(''); setCategory('odonto'); setFetched(false); setSubmitting(false);
    }
  }, [open]);

  const fetchCnpj = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('Informe os 14 dígitos do CNPJ.');
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      if (data.razao_social) setLegalName(data.razao_social);
      if (data.nome_fantasia) setTradeName(data.nome_fantasia);
      else if (data.razao_social && !tradeName) setTradeName(data.razao_social);
      if (data.ddd_telefone_1 && !phone) {
        setPhone(`(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`);
      }
      setFetched(true);
    } catch {
      toast('Não conseguimos preencher automaticamente. Você pode digitar os dados manualmente.');
    } finally {
      setFetching(false);
    }
  };

  // auto-fetch when 14 digits
  useEffect(() => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) { setFetched(false); return; }
    const t = setTimeout(() => { fetchCnpj(); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpj]);

  const handleSubmit = async () => {
    if (cnpj.replace(/\D/g, '').length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos'); return;
    }
    if (!legalName.trim() || !tradeName.trim() || !responsibleName.trim() || !phone.trim()) {
      toast.error('Preencha todos os campos obrigatórios'); return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-own-clinic', {
        body: {
          name: tradeName.trim(),
          legal_name: legalName.trim(),
          trade_name: tradeName.trim(),
          cnpj: cnpj.replace(/\D/g, ''),
          phone: phone.trim(),
          responsible_name: responsibleName.trim(),
          category,
        },
      });
      if (error || (data && data.error)) {
        toast.error((data && data.error) || error?.message || 'Falha ao cadastrar clínica.');
        return;
      }
      toast.success('Clínica cadastrada!');
      await refreshClinics();
      onOpenChange(false);
    } catch (err: any) {
      toast(err?.message || 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Cadastrar minha clínica
          </DialogTitle>
          <DialogDescription>
            Você ficará como dono. Só é possível ter uma clínica própria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rc-cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input id="rc-cnpj" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00" inputMode="numeric" autoFocus />
              <Button type="button" variant="outline" size="icon" onClick={fetchCnpj} disabled={fetching} className="flex-shrink-0">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : fetched ? <Check className="h-4 w-4 text-muted-foreground" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-legal">Razão Social</Label>
            <Input id="rc-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Clínica X LTDA" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-trade">Nome fantasia</Label>
            <Input id="rc-trade" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Clínica X" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-resp">Responsável</Label>
            <Input id="rc-resp" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome do responsável" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-phone">Telefone</Label>
            <Input id="rc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="odonto">Odontológica</SelectItem>
                <SelectItem value="medico">Médica</SelectItem>
                <SelectItem value="estetica">Estética</SelectItem>
                <SelectItem value="veterinario">Veterinária</SelectItem>
                <SelectItem value="outro">Outra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2 mt-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {submitting ? 'Cadastrando…' : 'Cadastrar clínica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}