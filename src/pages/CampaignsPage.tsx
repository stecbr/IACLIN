import { useAuth } from "@/contexts/AuthContext";
import CampaignsComponent from "@/components/campaigns/CampaignsPage";

export default function CampaignsPageWrapper() {
  const { currentClinicId } = useAuth();

  if (!currentClinicId) {
    return <div className="p-4">Carregando clínica...</div>;
  }

  return <CampaignsComponent clinicId={currentClinicId} />;
}
