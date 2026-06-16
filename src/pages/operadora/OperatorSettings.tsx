import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, Settings, KeyRound, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import iaclinDefaultLogo from '@/assets/iaclin-default-logo.png.asset.json';

export default function OperatorSettings() {
  const { operatorId, user } = useAuth();
  const queryClient = useQueryClient();
  const [op, setOp] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (!operatorId) return;
    supabase.from('insurance_operators').select('*').eq('id', operatorId).single()
      .then(({ data }) => setOp(data));
  }, [operatorId]);

  const openEdit = () => {
    setDraft({ ...op });
    setEditOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('insurance_operators').update({
      name: draft.name, legal_name: draft.legal_name, cnpj: draft.cnpj, ans_code: draft.ans_code,
      type: draft.type, brand_color: draft.brand_color, contact_email: draft.contact_email,
      contact_phone: draft.contact_phone, responsible_name: draft.responsible_name,
    }).eq('id', operatorId);
    setSaving(false);
    if (error) return toast.error('Erro: ' + error.message);
    setOp({ ...op, ...draft });
    setEditOpen(false);
    queryClient.invalidateQueries({ queryKey: ['operator-info', operatorId] });
    toast.success('Salvo');
  };

  const uploadLogo = async (file: File) => {
    if (!operatorId) return;
    const ext = file.name.split('.').pop();
    const path = `operators/${operatorId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
    if (upErr) return toast.error('Erro no upload: ' + upErr.message);
    const { data: pub } = supabase.storage.from('clinic-assets').getPublicUrl(path);
    const { error } = await supabase.from('insurance_operators').update({ logo_url: pub.publicUrl }).eq('id', operatorId);
    if (error) return toast.error('Erro ao salvar logo');
    setOp({ ...op, logo_url: pub.publicUrl });
    queryClient.invalidateQueries({ queryKey: ['operator-info', operatorId] });
    toast.success('Logo atualizada');
  };

  const removeLogo = async () => {
    if (!operatorId) return;
    const { error } = await supabase.from('insurance_operators').update({ logo_url: null }).eq('id', operatorId);
    if (error) return toast.error('Erro ao remover logo');
    setOp({ ...op, logo_url: null });
    queryClient.invalidateQueries({ queryKey: ['operator-info', operatorId] });
    toast.success('Logo removida — usando padrão IACLIN');
  };

  if (!op) return <Card className="p-8 text-sm text-muted-foreground">Carregando...</Card>;

  const typeLabel = (t?: string) =>
    t === 'odonto' ? 'Odontológica' : t === 'medico' ? 'Médica' : t === 'ambos' ? 'Médica e odontológica' : '—';

  const InfoRow = ({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) => (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${!value ? 'text-muted-foreground italic' : ''}`}>
        {value || 'Não informado'}
      </p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da sua operadora e segurança da conta</p>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="mb-4">
          <TabsTrigger value="dados" className="gap-2">
            <Settings className="h-4 w-4" /> Dados da Operadora
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2">
            <KeyRound className="h-4 w-4" /> Segurança
          </TabsTrigger>
        </TabsList>

        {/* ── Dados ── */}
        <TabsContent value="dados" className="space-y-6">
          <Card className="p-6 rounded-xl">
            <div>
              <Label className="block">Logo da operadora</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {op.logo_url
                  ? 'A logo enviada aparece no topo da sidebar e no cabeçalho do painel.'
                  : 'Usando a logo padrão IACLIN. Envie uma imagem para personalizar.'}
              </p>
            </div>
            <div className="flex justify-center my-6">
              <div className="h-28 w-28 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                <img
                  src={op.logo_url || iaclinDefaultLogo.url}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-border">
              {op.logo_url && (
                <Button variant="outline" size="sm" onClick={removeLogo} className="rounded-xl">
                  Remover e voltar para IACLIN
                </Button>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                />
                <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-input hover:bg-muted transition">
                  <Upload className="h-4 w-4" />
                  {op.logo_url ? 'Substituir logo' : 'Enviar logo'}
                </span>
              </label>
            </div>
          </Card>

          <Card className="p-6 space-y-5 rounded-xl">
            <div>
              <h2 className="text-base font-semibold">Informações da operadora</h2>
              <p className="text-xs text-muted-foreground">Dados cadastrais e de contato</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <InfoRow label="Nome fantasia" value={op.name} />
              <InfoRow label="Razão social" value={op.legal_name} />
              <InfoRow label="CNPJ" value={op.cnpj} mono />
              <InfoRow label="Código ANS" value={op.ans_code} mono />
              <InfoRow label="Tipo" value={typeLabel(op.type)} />
              <InfoRow label="E-mail" value={op.contact_email} />
              <InfoRow label="Telefone" value={op.contact_phone} />
              <div className="sm:col-span-2">
                <InfoRow label="Responsável" value={op.responsible_name} />
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={openEdit} className="gap-2 rounded-xl mt-3">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </div>
          </Card>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar informações da operadora</DialogTitle>
                <DialogDescription>Atualize os dados cadastrais e de contato.</DialogDescription>
              </DialogHeader>
              {draft && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                  <div><Label>Nome fantasia</Label><Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                  <div><Label>Razão social</Label><Input value={draft.legal_name ?? ''} onChange={(e) => setDraft({ ...draft, legal_name: e.target.value })} /></div>
                  <div><Label>CNPJ</Label><Input value={draft.cnpj ?? ''} onChange={(e) => setDraft({ ...draft, cnpj: e.target.value })} /></div>
                  <div><Label>Código ANS</Label><Input value={draft.ans_code ?? ''} onChange={(e) => setDraft({ ...draft, ans_code: e.target.value })} /></div>
                  <div>
                    <Label>Tipo</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                      <option value="medico">Médica</option>
                      <option value="odonto">Odontológica</option>
                      <option value="ambos">Médica e odontológica</option>
                    </select>
                  </div>
                  <div><Label>E-mail</Label><Input value={draft.contact_email ?? ''} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></div>
                  <div><Label>Telefone</Label><Input value={draft.contact_phone ?? ''} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Responsável</Label><Input value={draft.responsible_name ?? ''} onChange={(e) => setDraft({ ...draft, responsible_name: e.target.value })} /></div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </TabsContent>

        {/* ── Segurança ── */}
        <TabsContent value="seguranca">
          <SecuritySection user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecuritySection({ user }: { user: any }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error('Informe a senha atual');
      if (!newPassword || newPassword.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres');
      if (newPassword !== confirmPassword) throw new Error('As senhas não coincidem');
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });
      if (authErr) throw new Error('Senha atual incorreta');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowSuccess(true);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alterar senha'),
  });

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
          <CardDescription>Altere sua senha de acesso à plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="op-currentPwd">Senha atual</Label>
            <Input
              id="op-currentPwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="op-newPwd">Nova senha</Label>
            <Input
              id="op-newPwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="op-confirmPwd">Confirmar nova senha</Label>
            <Input
              id="op-confirmPwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => changePassword.mutate()}
              disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
              className="gap-2"
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center gap-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle>Senha alterada com sucesso!</DialogTitle>
            <DialogDescription>
              Na próxima vez que acessar a plataforma, use sua nova senha para fazer login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={() => setShowSuccess(false)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
