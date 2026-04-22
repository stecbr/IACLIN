import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FlaskConical, Scan, Pill, Send } from 'lucide-react';

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
}

const KIND_META: Record<RequestKind, { label: string; icon: typeof FlaskConical; color: string }> = {
  lab_exam:    { label: 'Exames laboratoriais', icon: FlaskConical, color: 'text-violet-500 bg-violet-500/10' },
  imaging_exam:{ label: 'Exames de imagem',     icon: Scan,         color: 'text-blue-500 bg-blue-500/10' },
  prescription:{ label: 'Prescrições / Receita',icon: Pill,         color: 'text-emerald-500 bg-emerald-500/10' },
  referral:    { label: 'Encaminhamentos',      icon: Send,         color: 'text-amber-500 bg-amber-500/10' },
};

export function RequestsEditor({ items, onChange, readOnly }: Props) {
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
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-2">
          <Input value={item.payload.medication ?? ''} onChange={(e) => update(item.id, 'medication', e.target.value)} placeholder="Medicamento (ex: Amoxicilina)" className="h-9 text-sm" disabled={readOnly} />
          <Input value={item.payload.concentration ?? ''} onChange={(e) => update(item.id, 'concentration', e.target.value)} placeholder="Concentração (500mg)" className="h-9 text-sm" disabled={readOnly} />
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
      </div>
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
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum item adicionado.</p>
                  ) : (
                    list.map((it) => (
                      <div key={it.id} className="flex gap-2 items-start p-2 rounded-md border border-border/40 bg-muted/20">
                        <div className="flex-1">{renderItem(it)}</div>
                        {!readOnly && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(it.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
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