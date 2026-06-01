import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import MyCredentialingSection from '@/components/settings/MyCredentialingSection';
import { useAuth } from '@/contexts/AuthContext';

export default function ClinicaCredentialings() {
  const { isClinicOwner, clinicRole } = useAuth();
  const isAdmin = isClinicOwner || clinicRole === 'admin';

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Credenciamentos da Clínica"
          description="Solicitações de credenciamento da clínica com operadoras"
        />
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            Apenas administradores da clínica podem gerenciar credenciamentos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credenciamentos da Clínica"
        description="Solicite e gerencie credenciamento da clínica com operadoras"
      />
      <MyCredentialingSection />
    </div>
  );
}
