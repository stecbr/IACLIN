import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Filter, Phone, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [insuranceFilter, setInsuranceFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const { data: patients = [], isLoading, refetch } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const filtered = patients.filter((p) => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf?.includes(search) ||
      p.phone?.includes(search) ||
      p.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active);
    const matchesInsurance =
      insuranceFilter === 'all' ||
      (insuranceFilter === 'with' && p.insurance_provider) ||
      (insuranceFilter === 'without' && !p.insurance_provider);
    return matchesSearch && matchesStatus && matchesInsurance;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Paciente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={insuranceFilter} onValueChange={setInsuranceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Convênio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with">Com convênio</SelectItem>
            <SelectItem value="without">Particular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Patient List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">Nenhum paciente encontrado</p>
          <Button variant="link" onClick={() => setShowForm(true)} className="mt-2">
            Cadastrar novo paciente
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => {
            const initials = patient.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <Link key={patient.id} to={`/patients/${patient.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow border-border/50 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">{patient.full_name}</p>
                        {!patient.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                        {patient.insurance_provider && (
                          <Badge variant="outline" className="text-xs">{patient.insurance_provider}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {patient.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {patient.phone}
                          </span>
                        )}
                        {patient.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {patient.email}
                          </span>
                        )}
                        {patient.cpf && (
                          <span className="text-xs text-muted-foreground">CPF: {patient.cpf}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <PatientFormDialog open={showForm} onOpenChange={setShowForm} onSuccess={refetch} />
    </div>
  );
}
