import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, Calendar, User, CreditCard, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PatientData {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  cpf?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  photo_url?: string | null;
}

interface PatientOverviewTabProps {
  patient: PatientData;
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return 'Não informado';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return 'Não informado';
  }
}

function formatGender(gender: string | null | undefined) {
  if (!gender) return 'Não informado';
  const map: Record<string, string> = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro',
    masculino: 'Masculino',
    feminino: 'Feminino',
    outro: 'Outro',
  };
  return map[gender.toLowerCase()] ?? gender;
}

export function PatientOverviewTab({ patient }: PatientOverviewTabProps) {
  const addressParts = [patient.address, patient.city, patient.state, patient.zip_code].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : 'Não informado';

  const fields = [
    { icon: Phone, label: 'Celular', value: patient.phone ?? 'Não informado' },
    { icon: Mail, label: 'Email', value: patient.email ?? 'Não informado' },
    { icon: Calendar, label: 'Data de Nascimento', value: formatDate(patient.date_of_birth) },
    { icon: User, label: 'Gênero', value: formatGender(patient.gender) },
    { icon: CreditCard, label: 'CPF', value: patient.cpf ?? 'Não informado' },
    { icon: MapPin, label: 'Endereço', value: address },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex flex-col items-center gap-3 sm:w-40">
            <Avatar className="h-24 w-24">
              <AvatarImage src={patient.photo_url ?? undefined} alt={patient.full_name ?? 'Paciente'} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                {getInitials(patient.full_name)}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold text-center leading-tight">{patient.full_name}</p>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium break-words">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
