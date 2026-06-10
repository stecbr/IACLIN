import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Loader2, Search, Check, MapPin, User as UserIcon, ArrowLeft } from 'lucide-react';
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
    if (!entityType) {
      toast.error('Escolha Pessoa Física ou Jurídica'); return;
    }
    if (entityType === 'juridica') {
      if (cnpj.replace(/\D/g, '').length !== 14) {
        toast.error('CNPJ deve ter 14 dígitos'); return;
      }
      if (!legalName.trim() || !tradeName.trim() || !responsibleName.trim() || !phone.trim()) {
        toast.error('Preencha todos os campos obrigatórios'); return;
      }
    } else {
      if (!fullName.trim()) { toast.error('Informe o nome completo'); return; }
      if (cpf.replace(/\D/g, '').length !== 11) { toast.error('CPF deve ter 11 dígitos'); return; }
      if (!phone.trim()) { toast.error('Informe o telefone'); return; }
    }
    if (!zipCode.trim() || !address.trim() || !addressNumber.trim() || !city.trim() || !state.trim()) {
      toast.error('Preencha o endereço completo da clínica'); return;
    }
    setSubmitting(true);
    try {
      const fullAddress = `${address.trim()}, ${addressNumber.trim()}${addressComplement ? ` - ${addressComplement.trim()}` : ''}${neighborhood ? ` - ${neighborhood.trim()}` : ''}`;
      const isPF = entityType === 'fisica';
      const { data, error } = await supabase.functions.invoke('create-own-clinic', {
        body: {
          name: isPF ? fullName.trim() : tradeName.trim(),
          legal_name: isPF ? null : legalName.trim(),
          trade_name: isPF ? fullName.trim() : tradeName.trim(),
          cnpj: isPF ? null : cnpj.replace(/\D/g, ''),
          phone: phone.trim(),
          responsible_name: isPF ? fullName.trim() : responsibleName.trim(),
          category,
          category_label: category === 'outro' ? categoryLabel.trim() || null : null,
          address: fullAddress,
          address_number: addressNumber.trim(),
          address_complement: addressComplement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip_code: zipCode.replace(/\D/g, ''),
          entity_type: entityType,
          cpf: isPF ? cpf.replace(/\D/g, '') : null,
          rg: isPF ? (rg.trim() || null) : null,
          birth_date: isPF ? (birthDate || null) : null,
          inss_pis: isPF ? (inssPis.trim() || null) : null,
          state_registration: stateRegistration.trim() || null,
          municipal_registration: municipalRegistration.trim() || null,
          cnes: cnes.trim() || null,
          specialty_certificate: specialtyCertificate.trim() || null,
          bank_name: bankName.trim() || null,
          bank_agency: bankAgency.trim() || null,
          bank_account: bankAccount.trim() || null,
          bank_account_type: bankAccount.trim() ? bankAccountType : null,
          bank_holder_document: bankHolderDocument.replace(/\D/g, '') || null,
        },
      });
      if (error || (data && data.error)) {
        toast.error((data && data.error) || error?.message || 'Falha ao cadastrar clínica.');
        return;
      }
      const clinicId = (data as any)?.clinic_id as string | undefined;
      // Upload de documentos do kit credenciamento
      if (clinicId) {
        const uploads: Promise<unknown>[] = [];
        for (const [docType, files] of Object.entries(docFiles)) {
          for (const file of files) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `${clinicId}/${docType}/${Date.now()}-${safeName}`;
            uploads.push((async () => {
              const up = await supabase.storage.from('clinic-documents').upload(path, file, { upsert: false });
              if (!up.error) {
                await supabase.from('clinic_documents' as any).insert({
                  clinic_id: clinicId,
                  doc_type: docType,
                  file_path: path,
                  file_name: file.name,
                });
              }
            })());
          }
        }
        if (uploads.length) {
          await Promise.allSettled(uploads);
        }
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
          {/* Tipo de pessoa */}
          {!entityType ? (
            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Como você vai se cadastrar?
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setEntityType('fisica')}
                  className="rounded-xl border bg-card p-5 text-left hover:border-primary transition-colors">
                  <UserIcon className="h-6 w-6 text-primary mb-2" />
                  <div className="font-semibold">Pessoa Física</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Profissional autônomo / consultório individual com CPF.
                  </p>
                </button>
                <button type="button" onClick={() => setEntityType('juridica')}
                  className="rounded-xl border bg-card p-5 text-left hover:border-primary transition-colors">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <div className="font-semibold">Pessoa Jurídica</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clínica / empresa formalizada com CNPJ.
                  </p>
                </button>
              </div>
            </section>
          ) : (<>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Cadastro como <strong>{entityType === 'fisica' ? 'Pessoa Física (CPF)' : 'Pessoa Jurídica (CNPJ)'}</strong>
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEntityType(null)}>
              <ArrowLeft className="h-3 w-3" /> Trocar
            </Button>
          </div>

          {entityType === 'fisica' && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5" /> Dados pessoais
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="rc-fn">Nome completo *</Label>
                  <Input id="rc-fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. João Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc-cpf">CPF *</Label>
                  <Input id="rc-cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc-rg">RG</Label>
                  <Input id="rc-rg" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="00.000.000-0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc-bd">Data de nascimento</Label>
                  <Input id="rc-bd" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc-inss">INSS / NIS / PIS</Label>
                  <Input id="rc-inss" value={inssPis} onChange={(e) => setInssPis(e.target.value)} placeholder="Número do INSS, NIS ou PIS" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rc-phone-pf">Telefone *</Label>
                  <Input id="rc-phone-pf" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </section>
          )}

          {entityType === 'juridica' && (
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
          )}

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

          {entityType === 'juridica' && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5" /> Responsável legal
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-resp">Nome completo do responsável *</Label>
                <Input id="rc-resp" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome completo do responsável legal" />
              </div>
            </section>
          )}

          {/* Documentação do kit credenciamento */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Documentação {entityType === 'fisica' ? '(Pessoa Física)' : '(Pessoa Jurídica)'}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rc-ie">Inscrição Estadual</Label>
                <Input id="rc-ie" value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} placeholder="Isento ou número" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-im">Inscrição Municipal</Label>
                <Input id="rc-im" value={municipalRegistration} onChange={(e) => setMunicipalRegistration(e.target.value)} placeholder="Número" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-cnes">CNES — Cadastro Nacional de Estabelecimento de Saúde</Label>
                <Input id="rc-cnes" value={cnes} onChange={(e) => setCnes(e.target.value)} placeholder="0000000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-esp">Certificado de especialização (se houver)</Label>
                <Input id="rc-esp" value={specialtyCertificate} onChange={(e) => setSpecialtyCertificate(e.target.value)} placeholder="Identificação / número" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 pt-2">
              {(entityType === 'fisica'
                ? [
                    { type: 'cro_dentista', label: 'CRO/CRM do profissional' },
                    { type: 'alvara', label: 'Alvará de funcionamento' },
                    { type: 'licenca_sanitaria', label: 'Licença sanitária' },
                    { type: 'cnes_doc', label: 'Comprovante CNES' },
                    { type: 'fotos_clinica', label: 'Fotos da clínica' },
                    { type: 'especializacao', label: 'Certificado de especialização' },
                  ]
                : [
                    { type: 'cartao_cnpj', label: 'Cartão CNPJ' },
                    { type: 'contrato_social', label: 'Contrato Social ou Requerimento Empresarial' },
                    { type: 'cro_clinica', label: 'CRO/CRM da clínica (responsável técnico)' },
                    { type: 'alvara', label: 'Alvará de funcionamento' },
                    { type: 'licenca_sanitaria', label: 'Licença sanitária' },
                    { type: 'cnes_doc', label: 'Comprovante CNES' },
                    { type: 'fotos_clinica', label: 'Fotos da clínica' },
                    { type: 'especializacao', label: 'Certificado de especialização' },
                  ]
              ).map((d) => (
                <div key={d.type} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <Label className="text-xs font-medium">{d.label}</Label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Selecionar arquivo(s)</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        setDocFiles((prev) => ({ ...prev, [d.type]: [...(prev[d.type] ?? []), ...files] }));
                      }}
                    />
                  </label>
                  {(docFiles[d.type] ?? []).map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDocFiles((prev) => ({ ...prev, [d.type]: (prev[d.type] ?? []).filter((_, idx) => idx !== i) }))}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Dados bancários */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> Dados bancários {entityType === 'fisica' ? '(PF)' : '(PJ)'}
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-bank">Banco</Label>
                <Input id="rc-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banco do Brasil, Itaú..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-ag">Agência</Label>
                <Input id="rc-ag" value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="0000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-acc">Conta</Label>
                <Input id="rc-acc" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="00000-0" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={bankAccountType === 'corrente' ? 'default' : 'outline'} onClick={() => setBankAccountType('corrente')}>Corrente</Button>
                  <Button type="button" size="sm" variant={bankAccountType === 'poupanca' ? 'default' : 'outline'} onClick={() => setBankAccountType('poupanca')}>Poupança</Button>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rc-hd">{entityType === 'fisica' ? 'CPF do titular' : 'CNPJ do titular'}</Label>
                <Input id="rc-hd" value={bankHolderDocument}
                  onChange={(e) => setBankHolderDocument(entityType === 'fisica' ? formatCpf(e.target.value) : formatCnpj(e.target.value))}
                  placeholder={entityType === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'} />
              </div>
            </div>
          </section>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {submitting ? 'Cadastrando…' : 'Cadastrar clínica'}
          </Button>
          </>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}