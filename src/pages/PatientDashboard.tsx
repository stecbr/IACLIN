import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { format, parseISO, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Phone, FileText, Plus, Sun, Moon, LogOut, Stethoscope,
  CheckCircle2, XCircle, Download, CreditCard, Pencil, Loader2, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

interface PatientAccount {
  id: string;
  cpf: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
}

interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  dentist_id: string;
  clinic_id: string | null;
  patient_id: string;
  dentist_name?: string;
  dentist_avatar?: string | null;
  clinic_name?: string;
  clinic_address?: string | null;
  clinic_city?: string | null;
  clinic_phone?: string | null;
}

interface DocumentRow {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  category: string | null;
  created_at: string;
  patient_id: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: 'Agendada', variant: 'default' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  completed: { label: 'Realizada', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  no_show: { label: 'Faltou', variant: 'destructive' },
};

export default function PatientDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { resolved, setTheme } = useTheme();

  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editProvider, setEditProvider] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Account
    const { data: acc } = await supabase
      .from('patient_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setAccount(acc);

    // 2. Patient records linked to this user (across clinics)
    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('patient_user_id', user.id);

    const patientIds = (patients ?? []).map(p => p.id);

    if (patientIds.length === 0) {
      setAppointments([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    // 3. Appointments + 4. Documents in parallel
    const [{ data: appts }, { data: docs }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, start_time, end_time, status, notes, dentist_id, clinic_id, patient_id')
        .in('patient_id', patientIds)
        .order('start_time', { ascending: false }),
      supabase
        .from('documents')
        .select('id, name, file_url, file_type, category, created_at, patient_id')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false }),
    ]);

    // Hydrate appointments with dentist + clinic info
    if (appts && appts.length > 0) {
      const dentistIds = [...new Set(appts.map(a => a.dentist_id))];
      const clinicIds = [...new Set(appts.map(a => a.clinic_id).filter(Boolean) as string[])];

      const [{ data: profs }, { data: clinics }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', dentistIds),
        clinicIds.length > 0
          ? supabase.from('clinics').select('id, name, address, city, phone').in('id', clinicIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profs ?? []).map(p => [p.id, p]));
      const clinMap = new Map((clinics ?? []).map(c => [c.id, c]));

      setAppointments(
        appts.map(a => ({
          ...a,
          dentist_name: profMap.get(a.dentist_id)?.full_name ?? 'Profissional',
          dentist_avatar: profMap.get(a.dentist_id)?.avatar_url ?? null,
          clinic_name: a.clinic_id ? clinMap.get(a.clinic_id)?.name ?? 'Clínica' : 'Clínica',
          clinic_address: a.clinic_id ? clinMap.get(a.clinic_id)?.address ?? null : null,
          clinic_city: a.clinic_id ? clinMap.get(a.clinic_id)?.city ?? null : null,
          clinic_phone: a.clinic_id ? clinMap.get(a.clinic_id)?.phone ?? null : null,
        }))
      );
    } else {
      setAppointments([]);
    }

    setDocuments(docs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const upcoming = appointments.filter(a => isFuture(parseISO(a.start_time)) && a.status !== 'cancelled');
  const past = appointments.filter(a => isPast(parseISO(a.start_time)) || a.status === 'cancelled');
  const next = upcoming[upcoming.length - 1]; // earliest future (sorted desc, so last)

  const initials = (profile?.full_name ?? account?.full_name ?? user?.email ?? 'P')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = (profile?.full_name ?? account?.full_name ?? '').split(' ')[0] || 'paciente';

  const handleConfirm = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Presença confirmada');
    fetchAll();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Consulta cancelada');
    fetchAll();
  };

  const openEditPlan = () => {
    setEditProvider(account?.insurance_provider ?? '');
    setEditNumber(account?.insurance_number ?? '');
    setEditOpen(true);
  };

  const savePlan = async () => {
    if (!account) return;
    setSavingPlan(true);
    const { error } = await supabase
      .from('patient_accounts')
      .update({ insurance_provider: editProvider || null, insurance_number: editNumber || null })
      .eq('id', account.id);
    setSavingPlan(false);
    if (error) return toast.error(error.message);
    toast.success('Convênio atualizado');
    setEditOpen(false);
    fetchAll();
  };

  const downloadDoc = async (doc: DocumentRow) => {
    // file_url stored as path inside bucket "patient-files"
    try {
      const { data, error } = await supabase.storage
        .from('patient-files')
        .createSignedUrl(doc.file_url, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      // Fallback: maybe it's already a public URL
      window.open(doc.file_url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <img src={resolved === 'dark' ? logoDark : logoLight} alt="IACLIN" className="h-7 object-contain" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe suas consultas, exames e plano de saúde.</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/marketplace')} className="gap-2">
                <Plus className="h-4 w-4" />
                Agendar nova consulta
              </Button>
            </div>

            {/* Next appointment */}
            {next ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary">Próxima consulta</p>
                      <Badge variant={statusMap[next.status]?.variant ?? 'default'}>
                        {statusMap[next.status]?.label ?? next.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={next.dentist_avatar ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {next.dentist_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{next.dentist_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {next.clinic_name}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="capitalize">
                          {format(parseISO(next.start_time), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{format(parseISO(next.start_time), 'HH:mm')}</span>
                      </div>
                      {(next.clinic_address || next.clinic_city) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{[next.clinic_address, next.clinic_city].filter(Boolean).join(' - ')}</span>
                        </div>
                      )}
                      {next.clinic_phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{next.clinic_phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {next.status !== 'confirmed' && (
                        <Button size="sm" onClick={() => handleConfirm(next.id)} className="gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Confirmar presença
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleCancel(next.id)} className="gap-1.5">
                        <XCircle className="h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card>
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Nenhuma consulta agendada</p>
                    <p className="text-sm text-muted-foreground">Encontre profissionais e marque sua próxima consulta.</p>
                  </div>
                  <Button onClick={() => navigate('/marketplace')} size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Agendar agora
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Insurance card */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
                <Card className="overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Plano de Saúde
                      </CardTitle>
                      <Button size="sm" variant="ghost" onClick={openEditPlan} className="gap-1 h-7">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {account?.insurance_provider ? (
                      <div className="space-y-1">
                        <p className="text-2xl font-bold tracking-tight">{account.insurance_provider}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {account.insurance_number ?? 'Sem nº de carteirinha'}
                        </p>
                        <p className="text-xs text-muted-foreground pt-2">
                          Titular: {account?.full_name}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Você ainda não cadastrou um convênio.</p>
                        <Button size="sm" variant="outline" onClick={openEditPlan} className="mt-3">
                          Adicionar convênio
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Documents */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Meus exames e documentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento ainda.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {documents.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => downloadDoc(doc)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(doc.created_at), "dd/MM/yyyy")} {doc.category && `· ${doc.category}`}
                              </p>
                            </div>
                            <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Appointment list */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" /> Minhas consultas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="upcoming">
                    <TabsList>
                      <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
                      <TabsTrigger value="past">Histórico ({past.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upcoming" className="mt-4 space-y-2">
                      {upcoming.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma consulta futura.</p>
                      ) : (
                        upcoming.map(a => <AppointmentRow key={a.id} a={a} />)
                      )}
                    </TabsContent>
                    <TabsContent value="past" className="mt-4 space-y-2">
                      {past.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Sem histórico de consultas.</p>
                      ) : (
                        past.map(a => <AppointmentRow key={a.id} a={a} />)
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>

      {/* Edit insurance dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar convênio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Input value={editProvider} onChange={(e) => setEditProvider(e.target.value)} placeholder="Ex: Amil, Unimed..." />
            </div>
            <div className="space-y-2">
              <Label>Nº carteirinha</Label>
              <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder="000000000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={savingPlan}>
              {savingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentRow({ a }: { a: AppointmentRow }) {
  const status = statusMap[a.status] ?? { label: a.status, variant: 'outline' as const };
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={a.dentist_avatar ?? undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {a.dentist_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{a.dentist_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {format(parseISO(a.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {a.clinic_name}
        </p>
      </div>
      <Badge variant={status.variant} className="flex-shrink-0">{status.label}</Badge>
    </div>
  );
}
