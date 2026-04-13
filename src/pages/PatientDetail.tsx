import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Phone, Mail, MapPin, Edit, Calendar, CreditCard, Clock, ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { BudgetFormDialog } from '@/components/budgets/BudgetFormDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const { currentClinicId } = useAuth();

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
      <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {/* Patient Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">{patient.full_name}</h1>
              {!patient.is_active && <Badge variant="secondary">Inativo</Badge>}
              {patient.insurance_provider && <Badge variant="outline">{patient.insurance_provider}</Badge>}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{patient.phone}</span>}
              {patient.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{patient.email}</span>}
              {patient.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{patient.city}{patient.state ? `, ${patient.state}` : ''}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit className="h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="appointments">Consultas</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Dados Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {patient.cpf && <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{patient.cpf}</span></div>}
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
          </div>
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

        <TabsContent value="financial">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
              <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <Card key={tx.id} className="p-4 border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.description ?? tx.category}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.due_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === 'receivable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'receivable' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2).replace('.', ',')}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {paymentStatusLabels[tx.status] ?? tx.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="timeline">
          <PatientTimeline patientId={id!} />
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
    </div>
  );
}
