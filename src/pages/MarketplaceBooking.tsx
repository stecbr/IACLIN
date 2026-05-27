import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookingConfirmation } from "@/components/marketplace/BookingConfirmation";
import { Loader2 } from "lucide-react";

export default function MarketplaceBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const dentistId = searchParams.get("dentistId");
  const clinicId = searchParams.get("clinicId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  const [loading, setLoading] = useState(true);
  const [dentistName, setDentistName] = useState("");
  const [dentistAvatar, setDentistAvatar] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicCity, setClinicCity] = useState<string | null>(null);
  const [insurancePlans, setInsurancePlans] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!dentistId || !clinicId || !date || !time) {
      navigate("/marketplace");
      return;
    }

    async function fetchData() {
      const [{ data: profile }, { data: clinic }, { data: plans }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", dentistId!).single(),
        supabase.from("clinics").select("name, city").eq("id", clinicId!).single(),
        supabase.from("insurance_plans").select("id, name").eq("clinic_id", clinicId!).eq("is_active", true),
      ]);

      setDentistName(profile?.full_name ?? "Profissional");
      setDentistAvatar(profile?.avatar_url ?? null);
      setClinicName(clinic?.name ?? "Clínica");
      setClinicCity(clinic?.city ?? null);
      setInsurancePlans(plans ?? []);
      setLoading(false);
    }

    fetchData();
  }, [dentistId, clinicId, date, time, navigate]);

  // Redirect to auth if not logged in (after auth finishes loading)
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = `/marketplace/agendar?${searchParams.toString()}`;
      navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [authLoading, user, navigate, searchParams]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dentistId || !clinicId || !date || !time) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <Link to="/marketplace" className="text-xl font-bold text-primary">IACLIN</Link>
      </header>
      <BookingConfirmation
        dentistId={dentistId}
        clinicId={clinicId}
        date={date}
        time={time}
        dentistName={dentistName}
        dentistAvatar={dentistAvatar}
        clinicName={clinicName}
        clinicCity={clinicCity}
        insurancePlans={insurancePlans}
      />
    </div>
  );
}
