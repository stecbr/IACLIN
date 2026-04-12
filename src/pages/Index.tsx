import { Calendar, Users, DollarSign, AlertTriangle, Plus, UserPlus, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const kpiCards = [
  {
    title: 'Consultas Hoje',
    value: '0',
    description: 'agendadas para hoje',
    icon: Calendar,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: 'Pacientes Ativos',
    value: '0',
    description: 'cadastrados',
    icon: Users,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    title: 'Receita do Mês',
    value: 'R$ 0,00',
    description: 'recebido este mês',
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    title: 'Taxa No-Show',
    value: '0%',
    description: 'faltas no mês',
    icon: AlertTriangle,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
];

const quickActions = [
  { label: 'Nova Consulta', icon: Plus, href: '/agenda' },
  { label: 'Novo Paciente', icon: UserPlus, href: '/patients' },
  { label: 'Registrar Pagamento', icon: CreditCard, href: '/financial' },
];

export default function Index() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Olá, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está o resumo da sua clínica hoje.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{kpi.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Ações Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="gap-2 border-border/50 hover:bg-accent"
              asChild
            >
              <a href={action.href}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
