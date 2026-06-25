import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Phone, Mail, MapPin, Edit, Calendar, CreditCard, Clock, ClipboardList, Plus, Heart, Image, MessageCircle, FileDown, Activity, Utensils, Brain, Stethoscope, Share2, Loader2, Star, Palette, MoreHorizontal, FolderOpen, Smile, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ClinicalMapPage from '@/components/clinical-map/ClinicalMapPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { PatientAnamnese } from '@/components/patients/PatientAnamnese';
import { PatientDocuments } from '@/components/patients/PatientDocuments';
import { PatientFiles } from '@/components/patients/PatientFiles';
import { PatientSpecialtyList } from '@/components/patients/PatientSpecialtyList';
import { PatientFinancialSummary } from '@/components/patient/PatientFinancialSummary';
import { TransactionDialog } from '@/components/finance/TransactionDialog';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { PATIENT_TAB_LABELS, type PatientTabKey } from '@/lib/specialtyProfile';
import { BudgetFormDialog } from '@/components/budgets/BudgetFormDialog';
import { generateBudgetPdf, fetchClinicForPdf } from '@/lib/generateBudgetPdf';
import { openFullChartPdf, fetchFullChartData } from '@/lib/generateFullChartPdf';
import { SharePatientChartDialog } from '@/components/patients/SharePatientChartDialog';
import { PatientPersonalizeMenu } from '@/components/patients/PatientPersonalizeMenu';
import { usePatientPersonalization } from '@/hooks/usePatientPersonalization';
import { PatientAlertsBar } from '@/components/attendance/PatientAlertsBar';
import { PatientVitalsChart } from '@/components/patients/PatientVitalsChart';
import { PatientPrescriptionHistory } from '@/components/patients/PatientPrescriptionHistory';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ptBR } from 'date-fns/locale';
import { formatCpf, formatPhone } from '@/lib/cpf';

function ClinicalAlertsSection({ patientId }: { patientId: string }) {
  const { data } = useQuery({
    queryKey: ['attendance-alerts', patientId],
    queryFn: async () => {
      const { data } = await supabase.from('anamneses')
        .select('allergies, medications, medical_conditions')
        .eq('patient_id', patientId)
        .order('updated_at', { ascending: false })
        .limit(1).maybeSingle();
      return data;
    },
    enabled: !!patientId,
  });
  if (!data || (!data.allergies && !data.medications && !data.medical_conditions)) return null;
  return (
    <div className="rounded-lg border border-rose-200/60 bg-rose-50/50 dark:border-rose-900/30 dark:bg-rose-950/10 px-4 py-2.5">
      <PatientAlertsBar patientId={patientId} />
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromBudgetId = (location.state as any)?.fromBudgetId as string | undefined;
  const fromRoute = (location.state as any)?.from as string | undefined;
  const backTo = fromRoute === '/prontuarios' ? '/prontuarios' : '/patients';
  const backLabel = fromRoute === '/prontuarios' ? 'Voltar aos prontuários' : 'Voltar';
  const [editOpen, setEditOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const { currentClinicId, user } = useAuth();
  const { profile } = useSpecialtyProfile();
  const { effectiveRole } = useRoleAccess();
  const canStartAttendance = effectiveRole === 'dentist';
  const { data: personalization } = usePatientPersonalization(id);
  const queryClient = useQueryClient();

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, procedures(name, color)')
        .eq('patient_id', id!)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['patient-transactions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('patient_id', id!)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: treatmentPlans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['patient-treatment-plans', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plans')
        .select('*, treatment_plan_items(id, procedure_id, price, tooth_number, procedures(name))')
        .eq('patient_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = patient.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-green-100 text-green-700',
    no_show: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    no_show: 'Faltou',
    cancelled: 'Cancelado',
  };

  const paymentStatusLabels: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Atrasado',
    cancelled: 'Cancelado',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {fromBudgetId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => navigate('/budgets', { state: { openBudgetId: fromBudgetId } })}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Voltar ao orçamento
          </Button>
        )}
      </div>

      {/* Patient Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            {patient.photo_url && <AvatarImage src={patient.photo_url} alt={patient.full_name} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {personalization.is_favorite && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
              <h1 className="text-xl font-semibold text-foreground leading-tight">{patient.full_name}</h1>
              {!patient.is_active && <Badge variant="secondary">Inativo</Badge>}
              {patient.insurance_provider && <Badge variant="outline">{patient.insurance_provider}</Badge>}
              {personalization.tag && (
                <Badge
                  variant="secondary"
                  style={
                    personalization.color
                      ? { backgroundColor: `${personalization.color}1A`, color: personalization.color }
                      : undefined
                  }
                >
                  {personalization.tag}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(patient.phone)}</span>}
              {patient.email && <span className="flex items-center gap-1 min-w-0 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{patient.email}</span>}
              {patient.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{patient.city}{patient.state ? `, ${patient.state}` : ''}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canStartAttendance && (
          <Button
            size="sm"
            className="gap-2"
            onClick={async () => {
              // Procura um atendimento ativo (in_progress) ou agendado para hoje deste paciente do dentista atual
              const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
              const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
              let q = supabase
                .from('appointments')
                .select('id, status, start_time')
                .eq('patient_id', id!)
                .gte('start_time', todayStart.toISOString())
                .lt('start_time', todayEnd.toISOString())
                .in('status', ['scheduled', 'confirmed', 'in_progress'])
                .order('start_time', { ascending: true })
                .limit(1);
              if (user) q = q.eq('dentist_id', user.id);
              const { data } = await q;
              const apt = (data ?? [])[0];
              if (apt) {
                navigate(`/atendimento/${apt.id}`);
              } else {
                toast.info('Nenhum agendamento de hoje encontrado. Abra a Agenda para criar um.');
                navigate('/agenda');
              }
            }}
          >
            <Stethoscope className="h-4 w-4" />
            Iniciar atendimento
          </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <MoreHorizontal className="h-4 w-4" />
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                disabled={exportingPdf}
                onSelect={async () => {
                  setExportingPdf(true);
                  try {
                    const data = await fetchFullChartData(id!);
                    await openFullChartPdf({ ...data, issued_by: null });
                  } catch (e: any) {
                    toast.error('Erro ao gerar PDF', { description: e.message });
                  } finally {
                    setExportingPdf(false);
                  }
                }}
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Exportar prontuário
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </DropdownMenuItem>
              {patient.phone && (
                <DropdownMenuItem asChild>
                  <a
                    href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 focus:text-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              {id && (
                <PatientPersonalizeMenu patientId={id}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Palette className="h-4 w-4 mr-2" />
                    Personalizar
                  </DropdownMenuItem>
                </PatientPersonalizeMenu>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SharePatientChartDialog
        patientId={id!}
        patientName={patient.full_name}
        patientPhone={patient.phone}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {id && <PatientFinancialSummary patientId={id} />}

      {/* Alertas clínicos — alergias, condições, medicações em uso */}
      {id && <ClinicalAlertsSection patientId={id} />}

      {/* Tabs */}
      <Tabs defaultValue={profile.patientTabs[0] ?? 'info'} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {profile.patientTabs.map((tab) => {
            const icon: Partial<Record<PatientTabKey, JSX.Element>> = {
              anamnese: <Heart className="h-3.5 w-3.5" />,
              budgets: <ClipboardList className="h-3.5 w-3.5" />,
              documents: <Image className="h-3.5 w-3.5" />,
              files: <FolderOpen className="h-3.5 w-3.5" />,
              timeline: <Clock className="h-3.5 w-3.5" />,
              sessions: <Brain className="h-3.5 w-3.5" />,
              evolution: <Activity className="h-3.5 w-3.5" />,
              mealplans: <Utensils className="h-3.5 w-3.5" />,
              odontogram: <Smile className="h-3.5 w-3.5" />,
            };
            return (
              <TabsTrigger key={tab} value={tab} className="gap-1.5">
                {icon[tab]}
                {PATIENT_TAB_LABELS[tab]}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="info">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Dados Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {patient.cpf && <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{formatCpf(patient.cpf)}</span></div>}
                {patient.date_of_birth && <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{format(new Date(patient.date_of_birth), "dd/MM/yyyy")}</span></div>}
                {patient.gender && <div><span className="text-muted-foreground">Gênero:</span> <span className="font-medium">{patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}</span></div>}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Endereço</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {patient.address && <div>{patient.address}</div>}
                {(patient.city || patient.state) && <div>{[patient.city, patient.state].filter(Boolean).join(' - ')}</div>}
                {patient.zip_code && <div>CEP: {patient.zip_code}</div>}
              </CardContent>
            </Card>
            {patient.insurance_provider && (
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Convênio</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>{patient.insurance_provider}</div>
                  {patient.insurance_number && <div>Nº: {patient.insurance_number}</div>}
                </CardContent>
              </Card>
            )}
            {patient.notes && (
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Observações</CardTitle></CardHeader>
                <CardContent className="text-sm">{patient.notes}</CardContent>
              </Card>
            )}
            {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
              <Card className="border-rose-200/50 dark:border-rose-900/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    Contato de Emergência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {patient.emergency_contact_name && (
                    <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{patient.emergency_contact_name}</span></div>
                  )}
                  {patient.emergency_contact_phone && (
                    <div>
                      <span className="text-muted-foreground">Telefone:</span>{' '}
                      <a href={`tel:${patient.emergency_contact_phone}`} className="font-medium text-primary hover:underline">
                        {formatPhone(patient.emergency_contact_phone)}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {id && <PatientVitalsChart patientId={id} />}
          </div>
        </TabsContent>

        <TabsContent value="anamnese">
          <PatientAnamnese patientId={id!} />
          {id && <div className="mt-4"><PatientPrescriptionHistory patientId={id} /></div>}
        </TabsContent>

        <TabsContent value="documents">
          <PatientDocuments patientId={id!} />
        </TabsContent>

        <TabsContent value="files">
          <PatientFiles patientId={id!} />
        </TabsContent>

        <TabsContent value="appointments">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
              <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt: any) => (
                <Card key={apt.id} className="p-4 border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: apt.procedures?.color ?? '#3B82F6' }} />
                      <div>
                        <p className="text-sm font-medium">{apt.procedures?.name ?? 'Consulta'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(apt.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs ${statusColors[apt.status] ?? ''}`}>
                      {statusLabels[apt.status] ?? apt.status}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="budgets">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => setBudgetOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Novo Orçamento
              </Button>
            </div>
            {treatmentPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
                <ClipboardList className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum orçamento para este paciente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {treatmentPlans.map((plan: any) => {
                  const statusLabel: Record<string, string> = { pending: 'Pendente', negotiating: 'Em Negociação', approved: 'Aprovado', lost: 'Perdido' };
                  const statusColor: Record<string, string> = {
                    pending: 'bg-amber-100 text-amber-700',
                    negotiating: 'bg-blue-100 text-blue-700',
                    approved: 'bg-emerald-100 text-emerald-700',
                    lost: 'bg-rose-100 text-rose-700',
                  };
                  return (
                    <Card key={plan.id} className="p-4 border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{plan.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {plan.treatment_plan_items?.length ?? 0} procedimentos · {format(new Date(plan.created_at), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Gerar PDF"
                            onClick={async () => {
                              try {
                                const clinic = await fetchClinicForPdf(currentClinicId);
                                await generateBudgetPdf({ plan, patient, clinic });
                              } catch (e: any) {
                                toast.error(e.message ?? 'Erro ao gerar PDF');
                              }
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-semibold">R$ {Number(plan.total_cost).toFixed(2).replace('.', ',')}</span>
                          <Badge className={`text-xs ${statusColor[plan.status] ?? ''}`}>
                            {statusLabel[plan.status] ?? plan.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              Cobranças e pagamentos vinculados a este paciente.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTxDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Nova cobrança
            </Button>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
              <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Nenhuma transação registrada</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTxDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Nova cobrança
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <Card key={tx.id} className="p-4 border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {tx.description ?? tx.category}
                        {tx.approval_status === 'awaiting_approval' && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-700 dark:border-amber-900/60 dark:text-amber-400">
                            Aguardando aprovação
                          </Badge>
                        )}
                        {tx.approval_status === 'rejected' && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-rose-300 text-rose-700 dark:border-rose-900/60 dark:text-rose-400">
                            Recusada
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.due_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2).replace('.', ',')}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {paymentStatusLabels[tx.status] ?? tx.status}
                        </Badge>
                        {tx.type === 'income' && tx.status !== 'paid' && tx.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingPaidId === tx.id}
                            className="h-6 px-2 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/60 dark:hover:bg-emerald-900/20"
                            onClick={async () => {
                              setMarkingPaidId(tx.id);
                              const today = format(new Date(), 'yyyy-MM-dd');
                              const { error } = await supabase
                                .from('financial_transactions')
                                .update({ status: 'paid', paid_date: today })
                                .eq('id', tx.id);
                              setMarkingPaidId(null);
                              if (error) {
                                toast.error('Erro ao marcar como pago', { description: error.message });
                              } else {
                                toast.success('Cobrança marcada como paga');
                                queryClient.invalidateQueries({ queryKey: ['patient-transactions', id] });
                                queryClient.invalidateQueries({ queryKey: ['patient-financial-status', id] });
                              }
                            }}
                          >
                            {markingPaidId === tx.id ? 'Salvando…' : 'Marcar como pago'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="odontogram">
          <ClinicalMapPage forceMapType="tooth" patientId={id} embedded />
        </TabsContent>

        <TabsContent value="timeline">
          <PatientTimeline patientId={id!} />
        </TabsContent>
        <TabsContent value="sessions">
          <PatientSpecialtyList patientId={id!} filterKey="soap" emptyLabel="Nenhuma sessão registrada" />
        </TabsContent>
        <TabsContent value="evolution">
          <PatientSpecialtyList patientId={id!} emptyLabel="Sem registros de evolução" />
        </TabsContent>
        <TabsContent value="mealplans">
          <PatientSpecialtyList patientId={id!} filterKey="mealplan" emptyLabel="Nenhum plano alimentar registrado" />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <PatientFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={refetch}
          patient={patient}
          clinicId={currentClinicId}
        />
      )}
      <BudgetFormDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        onSuccess={() => refetchPlans()}
        preselectedPatientId={id}
      />
      <TransactionDialog
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
        lockedPatientId={id}
        lockedPatientName={patient?.full_name}
        forcedClinicId={(patient as any)?.clinic_id ?? currentClinicId ?? null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patient-transactions', id] });
          queryClient.invalidateQueries({ queryKey: ['patient-financial-status', id] });
          queryClient.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
          queryClient.invalidateQueries({ queryKey: ['financial-awaiting-approval'] });
        }}
      />
    </div>
  );
}
