import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, MapPin, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCpf, isValidCpf, unmaskCpf } from "@/lib/cpf";

interface InsurancePlan {
  id: string;
  name: string;
}

interface BookingConfirmationProps {
  dentistId: string;
  clinicId: string;
  date: string;
  time: string;
  dentistName: string;
  dentistAvatar: string | null;
  clinicName: string;
  clinicCity: string | null;
  insurancePlans: InsurancePlan[];
}

export function BookingConfirmation({
  dentistId,
  clinicId,
  date,
  time,
  dentistName,
  dentistAvatar,
  clinicName,
  clinicCity,
  insurancePlans,
}: BookingConfirmationProps) {
  const navigate = useNavigate();
  const { user, isPatient } = useAuth();
  const [isParticular, setIsParticular] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [firstVisit, setFirstVisit] = useState<string>("yes");
  const [submitting, setSubmitting] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  // Pre-fill from patient_account if logged-in patient
  useEffect(() => {
    if (!user || !isPatient) return;
    supabase
      .from("patient_accounts")
      .select("full_name, cpf, phone, insurance_provider")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPatientName(data.full_name);
          setPatientCpf(formatCpf(data.cpf));
          setPatientPhone(data.phone ?? "");
          if (data.insurance_provider) {
            const match = insurancePlans.find(
              (p) => p.name.toLowerCase() === data.insurance_provider!.toLowerCase()
            );
            if (match) setSelectedPlanId(match.id);
          }
        }
      });
  }, [user, isPatient, insurancePlans]);

  const dateObj = parse(date, "yyyy-MM-dd", new Date());
  const formattedDate = format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const initials = dentistName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para agendar.");
      navigate("/auth");
      return;
    }

    if (!patientName.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!isValidCpf(patientCpf)) {
      toast.error("CPF inválido");
      return;
    }

    setSubmitting(true);
    try {
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      const noteText = `Agendado via marketplace. ${firstVisit === "yes" ? "Primeira consulta." : ""} ${
        isParticular ? "Particular" : selectedPlanId ? `Convênio: ${insurancePlans.find((p) => p.id === selectedPlanId)?.name}` : ""
      }`.trim();

      const { data, error } = await supabase.functions.invoke("request-appointment", {
        body: {
          clinicId,
          dentistId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: noteText,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("Pedido enviado!", {
        description: "A clínica vai confirmar sua consulta em breve.",
      });
      navigate(isPatient ? "/paciente" : "/marketplace");
    } catch (err: any) {
      toast.error(err.message || "Erro ao agendar consulta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Form */}
        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do paciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={patientCpf} onChange={(e) => setPatientCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecione as opções da consulta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Insurance */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Convênio médico</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="particular"
                    checked={isParticular}
                    onCheckedChange={(v) => {
                      setIsParticular(!!v);
                      if (v) setSelectedPlanId("");
                    }}
                  />
                  <Label htmlFor="particular" className="text-sm">Sem convênio (particular)</Label>
                </div>
                {!isParticular && insurancePlans.length > 0 && (
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o convênio" />
                    </SelectTrigger>
                    <SelectContent>
                      {insurancePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!isParticular && insurancePlans.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum convênio cadastrado para esta clínica.
                  </p>
                )}
              </div>

              {/* First visit */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">É a sua primeira consulta com este profissional?</Label>
                <RadioGroup value={firstVisit} onValueChange={setFirstVisit} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="first-yes" />
                    <Label htmlFor="first-yes">Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="first-no" />
                    <Label htmlFor="first-no">Não</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar agendamento
          </Button>
        </div>

        {/* Summary */}
        <div className="md:col-span-2">
          <Card className="sticky top-24">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={dentistAvatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{dentistName}</p>
                  <p className="text-xs text-muted-foreground">{clinicName}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span className="capitalize">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{time} (Horário de Brasília)</span>
                </div>
                {clinicCity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{clinicCity}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
