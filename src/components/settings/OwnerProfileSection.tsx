import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SpecialtySelect, validateRegistrationForSpecialty } from '@/components/SpecialtySelect';
import { getFamilyConfig } from '@/lib/specialtyFamily';

/**
 * Perfil do Proprietário — exibido em /settings para usuários que se
 * cadastraram diretamente como Clínica. Permite que o dono também atue
 * como profissional, configurando foto, dados, especialidade e biografia.
 */
export default function OwnerProfileSection() {
  const { user, currentClinicId, refreshClinics } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['owner-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url, bio')
        .eq('id', user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: member } = useQuery({
    queryKey: ['owner-clinic-member', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user || !currentClinicId) return null;
      const { data } = await supabase
        .from('clinic_members')
        .select('id, registration_number, specialty')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user && !!currentClinicId,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setAvatarUrl(profile.avatar_url ?? null);
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (member) {
      setRegistrationNumber(member.registration_number ?? '');
      setSpecialty(member.specialty ?? '');
    }
  }, [member]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Apenas imagens JPG, PNG, WebP ou GIF são permitidas');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5 MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `profiles/${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Foto carregada. Clique em salvar para confirmar.');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao enviar foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast.error('Informe seu nome completo'); return; }
    if (specialty) {
      const err = validateRegistrationForSpecialty(registrationNumber, specialty);
      if (err) { toast.error(err); return; }
    }
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          avatar_url: avatarUrl,
          bio: bio.trim() || null,
        } as any)
        .eq('id', user.id);
      if (pErr) throw pErr;

      if (member) {
        const { error: mErr } = await supabase
          .from('clinic_members')
          .update({
            registration_number: registrationNumber.trim() || null,
            specialty: specialty.trim() || null,
          } as any)
          .eq('id', member.id);
        if (mErr) throw mErr;
      }

      if (specialty.trim()) {
        const { data: existing } = await supabase
          .from('professional_specialties' as any)
          .select('id')
          .eq('user_id', user.id)
          .eq('specialty', specialty)
          .maybeSingle();
        await supabase
          .from('professional_specialties' as any)
          .update({ is_primary: false })
          .eq('user_id', user.id);
        if ((existing as any)?.id) {
          await supabase
            .from('professional_specialties' as any)
            .update({ is_primary: true })
            .eq('id', (existing as any).id);
        } else {
          await supabase
            .from('professional_specialties' as any)
            .insert({ user_id: user.id, specialty, is_primary: true });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['owner-profile'] });
      queryClient.invalidateQueries({ queryKey: ['owner-clinic-member'] });
      await refreshClinics();
      toast.success('Perfil atualizado!');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const initials = (fullName || user?.email || 'P')
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const regLabel = getFamilyConfig(specialty).registrationLabel;

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Perfil do Proprietário</CardTitle>
        <CardDescription>
          Como dono da clínica, você também pode atuar como profissional. Estas informações
          aparecem no Marketplace, nas Redes Médicas e no seu menu lateral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <label className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border border-input cursor-pointer hover:bg-muted transition">
            {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploadingAvatar ? 'Enviando...' : 'Enviar foto'}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              disabled={uploadingAvatar}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ownerName">Nome completo</Label>
            <Input id="ownerName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ownerPhone">Telefone</Label>
            <Input id="ownerPhone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>

        <div>
          <Label>Especialidade</Label>
          <SpecialtySelect
            value={specialty}
            onChange={setSpecialty}
            placeholder="Selecione sua especialidade (opcional)"
          />
        </div>

        <div>
          <Label htmlFor="ownerReg">{regLabel}</Label>
          <Input
            id="ownerReg"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder={`Digite seu ${regLabel}`}
          />
        </div>

        <div>
          <Label htmlFor="ownerBio">Biografia / Informações profissionais</Label>
          <Textarea
            id="ownerBio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Conte um pouco sobre sua formação, experiência e diferenciais..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}