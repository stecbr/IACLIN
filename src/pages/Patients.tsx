import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Search, UserPlus, Phone, Mail, LayoutGrid, List } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Users } from 'lucide-react';
import { SkeletonCards } from '@/components/SkeletonLoaders';

const AVATAR_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
];

function getGradient(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export default function Patients() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [insuranceFilter, setInsuranceFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const navigate = useNavigate();
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  });

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacientes"
        description={`${patients.length} paciente${patients.length !== 1 ? 's' : ''} cadastrado${patients.length !== 1 ? 's' : ''}`}
      >
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Paciente
        </Button>
      </PageHeader>

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
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Patient List */}
      {isLoading ? (
        <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum paciente encontrado"
          description={search ? 'Tente ajustar os filtros ou termos de busca.' : 'Cadastre seu primeiro paciente para começar.'}
          actionLabel="Cadastrar paciente"
          onAction={() => setShowForm(true)}
        />
      ) : viewMode === 'table' ? (
        <Card className="shadow-card border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Paciente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((patient) => (
                <TableRow key={patient.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/patients/${patient.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={`bg-gradient-to-br ${getGradient(patient.full_name)} text-white text-xs font-medium`}>
                            {getInitials(patient.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{patient.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{patient.phone ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{patient.email ?? '—'}</TableCell>
                    <TableCell>
                      {patient.insurance_provider ? (
                        <Badge variant="outline" className="text-xs">{patient.insurance_provider}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Particular</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={patient.is_active ? 'default' : 'secondary'} className="text-xs">
                        {patient.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => (
            <Link key={patient.id} to={`/patients/${patient.id}`}>
              <Card className="p-4 shadow-card hover:shadow-card-hover transition-all border-border/50 cursor-pointer">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`bg-gradient-to-br ${getGradient(patient.full_name)} text-white text-sm font-medium`}>
                      {getInitials(patient.full_name)}
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
          ))}
        </div>
      )}

      <PatientFormDialog open={showForm} onOpenChange={setShowForm} onSuccess={refetch} />
    </div>
  );
}
