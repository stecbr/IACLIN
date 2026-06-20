import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FlaskConical, Scan, Pill, Send, Copy, Sparkles, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useState, useMemo } from 'react';
import { DEFAULT_PRESCRIPTION_TEMPLATES } from '@/lib/prescriptionTemplates';
import { searchMedications, MEDICATION_SUGGESTIONS, type MedicationSuggestion } from '@/lib/medicationSuggestions';
import { checkDrugInteractions, SEVERITY_LABELS, SEVERITY_STYLES } from '@/lib/drugInteractions';
import { cn } from '@/lib/utils';

export type RequestKind = 'lab_exam' | 'imaging_exam' | 'prescription' | 'referral';

export interface RequestItem {
  id: string;
  kind: RequestKind;
  payload: Record<string, string>;
}

interface Props {
  items: RequestItem[];
  onChange: (items: RequestItem[]) => void;
  readOnly?: boolean;
  patientMedications?: string | null;
}

const KIND_META: Record<RequestKind, { label: string; icon: typeof FlaskConical; color: string }> = {
  lab_exam:    { label: 'Exames laboratoriais', icon: FlaskConical, color: 'text-violet-500 bg-violet-500/10' },
  imaging_exam:{ label: 'Exames de imagem',     icon: Scan,         color: 'text-blue-500 bg-blue-500/10' },
  prescription:{ label: 'Prescrições / Receita',icon: Pill,         color: 'text-emerald-500 bg-emerald-500/10' },
  referral:    { label: 'Encaminhamentos',      icon: Send,         color: 'text-amber-500 bg-amber-500/10' },
};

export function RequestsEditor({ items, onChange, readOnly, patientMedications }: Props) {
  const byKind = (k: RequestKind) => items.filter((i) => i.kind === k);

  const add = (kind: RequestKind) => {
    const empty: Record<RequestKind, Record<string, string>> = {
      lab_exam:    { name: '', justification: '', urgency: 'routine' },
      imaging_exam:{ name: '', region: '', justification: '' },
      prescription:{ medication: '', concentration: '', dosage: '', duration: '', route: 'oral', type: 'common' },
      referral:    { specialty: '', reason: '', urgency: 'routine' },
    };
    onChange([...items, { id: crypto.randomUUID(), kind, payload: empty[kind] }]);
  };

  const update = (id: string, field: string, value: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, payload: { ...i.payload, [field]: value } } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const updateMany = (id: string, patch: Record<string, string>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, payload: { ...i.payload, ...patch } } : i)));

  const duplicate = (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const src = items[idx];
    const copy = { id: crypto.randomUUID(), kind: src.kind, payload: { ...src.payload } };
    onChange([...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]);
  };

  const applyPrescriptionTemplate = (templateId: string) => {
    const tpl = DEFAULT_PRESCRIPTION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const next = tpl.items.map((it) => ({
      id: crypto.randomUUID(),
      kind: 'prescription' as RequestKind,
      payload: {
        medication: it.medication,
        concentration: '',
        dosage: [it.dosage, it.frequency].filter(Boolean).join(' '),
        duration: it.duration,
        route: 'oral',
        type: 'common',
      },
    }));
    onChange([...items, ...next]);
  };

  const prescriptionPreview = (p: Record<string, string>) => {
    const med = [p.medication, p.concentration].filter(Boolean).join(' ');
    const dose = [p.dosage, p.duration ? `por ${p.duration}` : '', p.route && p.route !== 'oral' ? `via ${p.route}` : '']
      .filter(Boolean)
      .join(' ');
    const tail = p.type === 'controlled' ? ' (receita controlada)' : '';
    if (!med && !dose) return null;
    return `${med}${dose ? ' — ' + dose : ''}${tail}`;
  };

  const renderItem = (item: RequestItem) => {
    if (item.kind === 'lab_exam' || item.kind === 'referral') {
      const isLab = item.kind === 'lab_exam';
      return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,140px] gap-2">
          <Input
            value={item.payload[isLab ? 'name' : 'specialty'] ?? ''}
            onChange={(e) => update(item.id, isLab ? 'name' : 'specialty', e.target.value)}
            placeholder={isLab ? 'Ex: Hemograma completo' : 'Ex: Cardiologia'}
            className="h-9 text-sm"
            disabled={readOnly}
          />
          <Input
            value={item.payload[isLab ? 'justification' : 'reason'] ?? ''}
            onChange={(e) => update(item.id, isLab ? 'justification' : 'reason', e.target.value)}
            placeholder={isLab ? 'Justificativa (opcional)' : 'Motivo do encaminhamento'}
            className="h-9 text-sm"
            disabled={readOnly}
          />
          <Select
            value={item.payload.urgency ?? 'routine'}
            onValueChange={(v) => update(item.id, 'urgency', v)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="routine">Rotina</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (item.kind === 'imaging_exam') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input value={item.payload.name ?? ''} onChange={(e) => update(item.id, 'name', e.target.value)} placeholder="Ex: Raio-X panorâmico" className="h-9 text-sm" disabled={readOnly} />
          <Input value={item.payload.region ?? ''} onChange={(e) => update(item.id, 'region', e.target.value)} placeholder="Região" className="h-9 text-sm" disabled={readOnly} />
          <Input value={item.payload.justification ?? ''} onChange={(e) => update(item.id, 'justification', e.target.value)} placeholder="Justificativa" className="h-9 text-sm" disabled={readOnly} />
        </div>
      );
    }
    // prescription
    return (
      <PrescriptionItemEditor
        item={item}
        update={update}
        updateMany={updateMany}
        readOnly={readOnly}
        preview={prescriptionPreview(item.payload)}
        patientMedications={patientMedications}
      />
    );
  };

  const kinds: RequestKind[] = ['lab_exam', 'imaging_exam', 'prescription', 'referral'];

  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <Accordion type="multiple" defaultValue={kinds} className="space-y-1">
          {kinds.map((k) => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            const list = byKind(k);
            return (
              <AccordionItem key={k} value={k} className="border border-border/50 rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">{meta.label}</span>
                    {list.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">{list.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-3 space-y-2">
                  {k === 'prescription' && !readOnly && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mr-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Modelos rápidos
                      </span>
                      {DEFAULT_PRESCRIPTION_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyPrescriptionTemplate(tpl.id)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                          title={tpl.description}
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum item adicionado.</p>
                  ) : (
                    list.map((it) => (
                      <div key={it.id} className="flex gap-2 items-start p-2 rounded-md border border-border/40 bg-muted/20">
                        {k === 'prescription' && (
                          <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                            {list.indexOf(it) + 1}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">{renderItem(it)}</div>
                        {!readOnly && (
                          <div className="flex gap-0.5">
                            {k === 'prescription' && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicate(it.id)} title="Duplicar">
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(it.id)} title="Remover">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={() => add(k)} className="gap-1.5 w-full">
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function PrescriptionItemEditor({
  item,
  update,
  updateMany,
  readOnly,
  preview,
  patientMedications,
}: {
  item: RequestItem;
  update: (id: string, field: string, value: string) => void;
  updateMany: (id: string, patch: Record<string, string>) => void;
  readOnly?: boolean;
  preview: string | null;
  patientMedications?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = searchMedications(query, 10);

  const interactions = useMemo(() => {
    if (!patientMedications || !item.payload.medication) return [];
    return checkDrugInteractions(item.payload.medication, patientMedications);
  }, [item.payload.medication, patientMedications]);

  const select = (m: MedicationSuggestion) => {
    updateMany(item.id, {
      medication: m.name,
      concentration: m.concentration,
      dosage: item.payload.dosage || [m.defaultDosage, m.defaultFrequency].filter(Boolean).join(' '),
    });
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-2">
        <Popover open={open && !readOnly} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                value={item.payload.medication ?? ''}
                onChange={(e) => {
                  update(item.id, 'medication', e.target.value);
                  setQuery(e.target.value);
                  if (!open) setOpen(true);
                }}
                onFocus={() => !readOnly && setOpen(true)}
                placeholder="Medicamento (digite para buscar)"
                className="h-9 text-sm pr-7"
                disabled={readOnly}
              />
              <Pill className={cn('absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5', item.payload.medication ? 'text-primary' : 'text-muted-foreground/50')} />
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[320px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandInput placeholder="Buscar medicamento..." value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>Nenhum medicamento encontrado.</CommandEmpty>
                <CommandGroup heading="Sugestões">
                  {(query ? results : MEDICATION_SUGGESTIONS.slice(0, 10)).map((m, i) => (
                    <CommandItem key={`${m.name}-${m.concentration}-${i}`} value={`${m.name} ${m.concentration}`} onSelect={() => select(m)}>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {m.name} <span className="text-muted-foreground">{m.concentration}</span>
                        </span>
                        {m.category && <span className="text-[10px] text-muted-foreground">{m.category}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input value={item.payload.concentration ?? ''} onChange={(e) => update(item.id, 'concentration', e.target.value)} placeholder="Concentração (ex: 500mg)" className="h-9 text-sm" disabled={readOnly} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1fr] gap-2">
        <Input value={item.payload.dosage ?? ''} onChange={(e) => update(item.id, 'dosage', e.target.value)} placeholder="Posologia (1 cp 8/8h)" className="h-9 text-sm" disabled={readOnly} />
        <Input value={item.payload.duration ?? ''} onChange={(e) => update(item.id, 'duration', e.target.value)} placeholder="Duração (7 dias)" className="h-9 text-sm" disabled={readOnly} />
        <Select value={item.payload.route ?? 'oral'} onValueChange={(v) => update(item.id, 'route', v)} disabled={readOnly}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="oral">Oral</SelectItem>
            <SelectItem value="topical">Tópica</SelectItem>
            <SelectItem value="injectable">Injetável</SelectItem>
            <SelectItem value="inhalation">Inalatória</SelectItem>
            <SelectItem value="other">Outra</SelectItem>
          </SelectContent>
        </Select>
        <Select value={item.payload.type ?? 'common'} onValueChange={(v) => update(item.id, 'type', v)} disabled={readOnly}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="common">Comum</SelectItem>
            <SelectItem value="controlled">Controlada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {preview && (
        <p className="text-[11px] text-muted-foreground italic pl-0.5">{preview}</p>
      )}
      {interactions.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {interactions.map((inter, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                SEVERITY_STYLES[inter.severity]
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">{SEVERITY_LABELS[inter.severity]}:</span>{' '}
                {inter.description}
                <span className="ml-1 opacity-70">
                  ({inter.drugs.join(' + ')})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}