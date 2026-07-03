import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  KeyRound, Plug, BookOpen, Plus, Copy, Ban, Loader2, AlertTriangle, Check,
} from 'lucide-react';
import { format } from 'date-fns';

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/operator-api`;

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRawKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `iac_live_${hex}`;
}

export default function OperatorIntegration() {
  const { operatorId } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);

  const loadKeys = async () => {
    if (!operatorId) return;
    const { data } = await supabase
      .from('operator_api_keys')
      .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false });
    setKeys((data ?? []) as ApiKeyRow[]);
  };

  useEffect(() => { loadKeys(); }, [operatorId]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Integração / API</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seus próprios sistemas à IACLIN para consultar beneficiários, rede credenciada e tabela de valores.
        </p>
      </div>

      <Tabs defaultValue="chaves">
        <TabsList className="mb-4">
          <TabsTrigger value="chaves" className="gap-2">
            <KeyRound className="h-4 w-4" /> Chaves de API
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="h-4 w-4" /> Documentação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chaves" className="space-y-6">
          <ApiKeysSection operatorId={operatorId} keys={keys} onChanged={loadKeys} />
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <DocsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApiKeysSection({
  operatorId, keys, onChanged,
}: { operatorId: string | null | undefined; keys: ApiKeyRow[] | null; onChanged: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const createKey = async () => {
    if (!operatorId || !name.trim()) return;
    setCreating(true);
    try {
      const raw = generateRawKey();
      const hash = await sha256Hex(raw);
      const { error } = await supabase.from('operator_api_keys').insert({
        operator_id: operatorId,
        name: name.trim(),
        key_prefix: raw.slice(0, 17),
        key_hash: hash,
      });
      if (error) throw error;
      setNewKey(raw);
      setName('');
      onChanged();
    } catch (err: any) {
      toast.error('Erro ao gerar chave: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase
      .from('operator_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', revokeTarget.id);
    setRevoking(false);
    if (error) return toast.error('Erro ao revogar: ' + error.message);
    toast.success('Chave revogada');
    setRevokeTarget(null);
    onChanged();
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setNewKey(null);
    setName('');
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Chaves de API</CardTitle>
            <CardDescription>
              Cada chave dá acesso de leitura aos dados da sua operadora. Gere uma para cada sistema externo que for integrar.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Gerar nova chave
          </Button>
        </CardHeader>
        <CardContent>
          {keys === null ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : keys.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Plug className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma chave gerada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(k.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at ? format(new Date(k.last_used_at), 'dd/MM/yyyy HH:mm') : 'Nunca usada'}
                    </TableCell>
                    <TableCell>
                      {k.revoked_at ? (
                        <Badge variant="secondary" className="text-muted-foreground">Revogada</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Ativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!k.revoked_at && (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setRevokeTarget(k)}>
                          <Ban className="h-3.5 w-3.5" /> Revogar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) closeCreate(); else setCreateOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          {!newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Gerar nova chave de API</DialogTitle>
                <DialogDescription>Dê um nome para identificar onde essa chave será usada (ex: "ERP interno").</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Label htmlFor="key-name">Nome da chave</Label>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sistema financeiro" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate} disabled={creating}>Cancelar</Button>
                <Button onClick={createKey} disabled={!name.trim() || creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar chave
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Chave gerada com sucesso</DialogTitle>
                <DialogDescription>
                  Copie e guarde essa chave agora — por segurança, ela não será exibida novamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5">
                  <code className="flex-1 text-xs break-all font-mono">{newKey}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyKey}>
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Se você perder essa chave, será preciso gerar outra e revogar essa. Consulte a aba "Documentação" para ver como usá-la.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeCreate}>Concluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave "{revokeTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Qualquer sistema usando essa chave perderá acesso imediatamente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={revokeKey} disabled={revoking} className="bg-destructive hover:bg-destructive/90">
              {revoking ? 'Revogando...' : 'Revogar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-xl border border-border bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
      {children}
    </pre>
  );
}

function DocsSection() {
  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Como usar</CardTitle>
          <CardDescription>Envie sua chave no cabeçalho <code className="font-mono">x-api-key</code> em requisições GET.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL base</Label>
          <CodeBlock>{API_BASE}</CodeBlock>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Exemplo (curl)</Label>
          <CodeBlock>{`curl "${API_BASE}?resource=ping" \\\n  -H "x-api-key: SUA_CHAVE_AQUI"`}</CodeBlock>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recursos disponíveis</CardTitle>
          <CardDescription>Todos os endpoints são somente leitura (GET) e aceitam <code className="font-mono">limit</code> e <code className="font-mono">offset</code> para paginação (limite máximo 200).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ResourceDoc
            title="Beneficiários"
            resource="beneficiaries"
            description="Lista os beneficiários ativos cadastrados na sua operadora."
            example={`{
  "data": [
    { "id": "...", "full_name": "Maria Silva", "cpf": "...",
      "card_number": "...", "plan_name": "...", "plan_type": "...",
      "status": "active", "enrolled_at": "...", "next_due_date": "..." }
  ],
  "meta": { "count": 120, "limit": 50, "offset": 0 }
}`}
          />
          <ResourceDoc
            title="Rede credenciada"
            resource="network"
            description="Lista profissionais e clínicas credenciados (status aprovado)."
            example={`{
  "data": [
    { "professional_id": "...", "professional_name": "Dr. João",
      "clinic_id": "...", "clinic_name": "Clínica Sorriso",
      "clinic_city": "...", "clinic_state": "...", "clinic_phone": "...",
      "credentialed_at": "..." }
  ],
  "meta": { "count": 8, "limit": 50, "offset": 0 }
}`}
          />
          <ResourceDoc
            title="Tabela de valores"
            resource="price-table"
            description="Retorna os procedimentos da tabela de valores vigente."
            example={`{
  "data": [
    { "procedure_name": "Consulta", "tuss_code": "...", "category": "...",
      "charge_type": "Geral", "value_brl": 150.0 }
  ],
  "meta": { "count": 40, "limit": 50, "offset": 0,
    "table": { "id": "...", "name": "Tabela 2026" } }
}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceDoc({
  title, resource, description, example,
}: { title: string; resource: string; description: string; example: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">GET ?resource={resource}</Badge>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <CodeBlock>{example}</CodeBlock>
    </div>
  );
}
