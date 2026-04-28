import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Building2, Save, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  registrationLabelForSpecialty,
  registrationPlaceholderForSpecialty,
  validateRegistrationForSpecialty,
  specialtyLabel,
} from '@/components/SpecialtySelect';

export default function Profile() {
  const { user, profile, currentClinicId, clinics } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Fetch clinic_member row for current clinic
  const { data: member } = useQuery({
    queryKey: ['my-clinic-member', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user || !currentClinicId) return null;
      const { data } = await supabase.from('clinic_members')
        .select('id, specialty, registration_number, role, is_owner')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!currentClinicId,
  });

  const { data: profileFull } = useQuery({
    queryKey: ['my-profile-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profileFull) {
      setFullName(profileFull.full_name ?? '');
      setPhone(profileFull.phone ?? '');
    }
  }, [profileFull]);

  useEffect(() => {
    if (member) {
      setSpecialty(member.specialty ?? '');
      setRegistrationNumber(member.registration_number ?? '');
    }
  }, [member]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('no user');
      const regError = validateRegistrationForSpecialty(registrationNumber, specialty);
      if (regError) throw new Error(regError);
      const { error: pErr } = await supabase.from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', user.id);
      if (pErr) throw pErr;
      if (member && currentClinicId) {
        const { error: mErr } = await supabase.from('clinic_members')
          .update({ specialty: specialty || null, registration_number: registrationNumber || null })
          .eq('id', member.id);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      toast.success('Perfil atualizado');
      queryClient.invalidateQueries({ queryKey: ['my-profile-full'] });
      queryClient.invalidateQueries({ queryKey: ['my-clinic-member'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Senha alterada');
      setNewPassword('');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alterar senha'),
  });

  const initials = (fullName || profile?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Meu Perfil" description="Dados pessoais e profissionais" />

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Informações pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              <p>{user?.email}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          {member && (
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
              <div>
                <Label htmlFor="specialty">Especialidade</Label>
                <Input id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Ortodontia" />
              </div>
              <div>
                <Label htmlFor="reg">{registrationLabelForSpecialty(specialty)}</Label>
                <Input
                  id="reg"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder={registrationPlaceholderForSpecialty(specialty)}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      {clinics.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Minhas clínicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clinics.map((c) => (
                <div key={c.clinic_id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.clinic_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role} {c.is_owner && '· proprietário'}</p>
                  </div>
                  {c.clinic_id === currentClinicId && (
                    <Badge variant="secondary" className="text-xs">Atual</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="newPwd">Nova senha</Label>
            <Input id="newPwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => changePassword.mutate()} disabled={!newPassword || changePassword.isPending}>
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
