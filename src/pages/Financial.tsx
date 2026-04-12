import { DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default function Financial() {
  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" description="Controle financeiro da clínica." />
      <EmptyState
        icon={DollarSign}
        title="Módulo em desenvolvimento"
        description="O controle financeiro completo com contas a receber, a pagar e fluxo de caixa estará disponível em breve."
      />
    </div>
  );
}
