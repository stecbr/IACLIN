import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClinicBranding {
  logoUrl: string | null;
  hideIaclinLogo: boolean;
}

export function useClinicBranding(): ClinicBranding {
  const { currentClinicId } = useAuth();
  const { data } = useQuery({
    queryKey: ['clinic-branding', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async (): Promise<ClinicBranding> => {
      if (!currentClinicId) return { logoUrl: null, hideIaclinLogo: false };
      const { data } = await supabase
        .from('clinics')
        .select('logo_url, hide_iaclin_logo')
        .eq('id', currentClinicId)
        .maybeSingle();
      return {
        logoUrl: (data as any)?.logo_url ?? null,
        hideIaclinLogo: !!(data as any)?.hide_iaclin_logo,
      };
    },
    staleTime: 60_000,
  });
  return data ?? { logoUrl: null, hideIaclinLogo: false };
}