import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Loader2, Search, Check, MapPin, User as UserIcon, FileText, Landmark, Upload, X, ArrowLeft } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getFamilyConfig } from '@/lib/specialtyFamily';

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

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'odonto', label: 'Odontológica' },
  { value: 'medico', label: 'Médica' },
  { value: 'estetica', label: 'Estética' },
  { value: 'outro', label: 'Outra' },
];

/** Deriva a categoria de clínica mais adequada a partir da especialidade do usuário */
function deriveClinicCategory(specialty: string | undefined, existingCategory: string | undefined): string {
  if (existingCategory && existingCategory !== 'odonto') return existingCategory;
  if (!specialty) return 'medico';
  const { family } = getFamilyConfig(specialty);
  switch (family) {
    case 'odonto':    return 'odonto';
    case 'aesthetic': return 'estetica';
    default:          return 'medico'; // psi, physio, nutrition, podology, medico
  }
}

export function RegisterClinicDialog({ open, onOpenChange }: RegisterClinicDialogProps) {
  const { refreshClinics, user } = useAuth();

  const userMetaCategory = (user?.user_metadata as any)?.clinic_category as string | undefined;
  const userMetaSpecialty = (user?.user_metadata as any)?.specialty as string | undefined;

  // Apenas dentistas têm a categoria travada em 'odonto'
  // Não usa clinicCategory — essa é a clínica ativa, não a que está sendo cadastrada
  const isDentistFlow =
    userMetaCategory === 'odonto' ||
    (!!userMetaSpecialty && getFamilyConfig(userMetaSpecialty).family === 'odonto');

  const defaultCategory = isDentistFlow
    ? 'odonto'
    : deriveClinicCategory(userMetaSpecialty, userMetaCategory);

  const [cnpj, setCnpj] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>(defaultCategory);
  const [categoryLabel, setCategoryLabel] = useState<string>('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  // Tipo de pessoa
  const [entityType, setEntityType] = useState<'fisica' | 'juridica' | null>(null);
  // Pessoa Física
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inssPis, setInssPis] = useState('');
  // Documentação adicional (PF e PJ)
  const [stateRegistration, setStateRegistration] = useState('');
  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [cnes, setCnes] = useState('');
  const [specialtyCertificate, setSpecialtyCertificate] = useState('');
  // Banco
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountType, setBankAccountType] = useState<'corrente' | 'poupanca'>('corrente');
  const [bankHolderDocument, setBankHolderDocument] = useState('');
  // Anexos (kit credenciamento)
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  // Address
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntityType(null);
      setFullName(''); setCpf(''); setRg(''); setBirthDate(''); setInssPis('');
      setStateRegistration(''); setMunicipalRegistration(''); setCnes(''); setSpecialtyCertificate('');
      setBankName(''); setBankAgency(''); setBankAccount(''); setBankAccountType('corrente'); setBankHolderDocument('');
      setDocFiles({});
      setCnpj(''); setLegalName(''); setTradeName(''); setResponsibleName('');
      setPhone(''); setCategory(defaultCategory);
      setCategoryLabel(''); setCategoryQuery('');
      setZipCode(''); setAddress(''); setAddressNumber(''); setAddressComplement('');
      setNeighborhood(''); setCity(''); setState('');
      setFetched(false); setSubmitting(false);
    } else if (isDentistFlow) {
      setCategory('odonto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // pré-preencher endereço quando vier do BrasilAPI
      if (data.cep && !zipCode) setZipCode(formatCep(String(data.cep)));
      if (data.logradouro && !address) setAddress(data.logradouro);
      if (data.numero && !addressNumber) setAddressNumber(String(data.numero));
      if (data.complemento && !addressComplement) setAddressComplement(data.complemento);
      if (data.bairro && !neighborhood) setNeighborhood(data.bairro);
      if (data.municipio && !city) setCity(data.municipio);
      if (data.uf && !state) setState(data.uf);
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

  // auto-fetch ViaCEP when CEP has 8 digits
  useEffect(() => {
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    let cancelled = false;
    setFetchingCep(true);
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.erro) return;
        if (data.logradouro) setAddress(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setFetchingCep(false); });
    return () => { cancelled = true; };
  }, [zipCode]);

  const handleSubmit = async () => {
    if (cnpj.replace(/\D/g, '').length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos'); return;
    }
    if (!legalName.trim() || !tradeName.trim() || !responsibleName.trim() || !phone.trim()) {
      toast.error('Preencha todos os campos obrigatórios'); return;
    }
    if (!zipCode.trim() || !address.trim() || !addressNumber.trim() || !city.trim() || !state.trim()) {
      toast.error('Preencha o endereço completo da clínica'); return;
    }
    setSubmitting(true);
    try {
      const fullAddress = `${address.trim()}, ${addressNumber.trim()}${addressComplement ? ` - ${addressComplement.trim()}` : ''}${neighborhood ? ` - ${neighborhood.trim()}` : ''}`;
      const { data, error } = await supabase.functions.invoke('create-own-clinic', {
        body: {
          name: tradeName.trim(),
          legal_name: legalName.trim(),
          trade_name: tradeName.trim(),
          cnpj: cnpj.replace(/\D/g, ''),
          phone: phone.trim(),
          responsible_name: responsibleName.trim(),
          category,
          category_label: category === 'outro' ? categoryLabel.trim() || null : null,
          address: fullAddress,
          address_number: addressNumber.trim(),
          address_complement: addressComplement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip_code: zipCode.replace(/\D/g, ''),
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

  const categoryFiltered = CATEGORY_OPTIONS.filter((c) =>
    !categoryQuery || c.label.toLowerCase().includes(categoryQuery.toLowerCase()),
  );
  const selectedCategoryLabel =
    category === 'outro' && categoryLabel
      ? categoryLabel
      : CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Cadastrar minha clínica
          </DialogTitle>
          <DialogDescription>
            Você ficará como dono. Só é possível ter uma clínica própria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Dados da Empresa */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Dados da empresa
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-cnpj">CNPJ *</Label>
                <div className="flex gap-2">
                  <Input id="rc-cnpj" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00" inputMode="numeric" autoFocus />
                  <Button type="button" variant="outline" size="icon" onClick={fetchCnpj} disabled={fetching} className="flex-shrink-0">
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : fetched ? <Check className="h-4 w-4 text-muted-foreground" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-legal">Razão Social *</Label>
                <Input id="rc-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Clínica X LTDA" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-trade">Nome fantasia *</Label>
                <Input id="rc-trade" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Clínica X" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-phone">Telefone *</Label>
                <Input id="rc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Popover open={categoryOpen && !isDentistFlow} onOpenChange={(v) => !isDentistFlow && setCategoryOpen(v)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isDentistFlow}
                      className={cn(
                        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
                    >
                      <span className="truncate">{isDentistFlow ? 'Odontológica' : selectedCategoryLabel || 'Selecione ou digite...'}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        value={categoryQuery}
                        onChange={(e) => setCategoryQuery(e.target.value)}
                        placeholder="Buscar ou digitar nova categoria..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {categoryFiltered.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setCategory(c.value);
                            if (c.value !== 'outro') setCategoryLabel('');
                            setCategoryOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground',
                            category === c.value && 'bg-accent/60',
                          )}
                        >
                          {c.label}
                          {category === c.value && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                      {categoryQuery.trim() && !categoryFiltered.some((c) => c.label.toLowerCase() === categoryQuery.toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategory('outro');
                            setCategoryLabel(categoryQuery.trim());
                            setCategoryOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="text-muted-foreground">Usar:</span>
                          <span className="font-medium">{categoryQuery.trim()}</span>
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {isDentistFlow && (
                  <p className="text-[11px] text-muted-foreground">
                    Categoria fixada por se tratar de um cadastro odontológico.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Endereço da clínica
            </div>
            <div className="grid md:grid-cols-6 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-cep">CEP *</Label>
                <div className="relative">
                  <Input id="rc-cep" value={zipCode} onChange={(e) => setZipCode(formatCep(e.target.value))}
                    placeholder="00000-000" inputMode="numeric" />
                  {fetchingCep && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-4">
                <Label htmlFor="rc-address">Logradouro *</Label>
                <Input id="rc-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, Avenida..." />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="rc-num">Número *</Label>
                <Input id="rc-num" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="123" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-comp">Complemento</Label>
                <Input id="rc-comp" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} placeholder="Sala 101" />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label htmlFor="rc-bairro">Bairro</Label>
                <Input id="rc-bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Centro" />
              </div>
              <div className="space-y-1.5 md:col-span-4">
                <Label htmlFor="rc-city">Cidade *</Label>
                <Input id="rc-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-state">UF *</Label>
                <Input id="rc-state" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
              </div>
            </div>
          </section>

          {/* Responsável */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" /> Responsável legal
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-resp">Nome completo do responsável *</Label>
              <Input id="rc-resp" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome completo do responsável legal" />
            </div>
          </section>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {submitting ? 'Cadastrando…' : 'Cadastrar clínica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}