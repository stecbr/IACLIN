import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Banner exibido para clínicas cadastradas diretamente que ainda não
 * concluíram o credenciamento (is_published = false). Sumido em /settings.
 */
export function PublishPendingBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentClinicId } = useAuth();
  const isClinicSignup = useIsClinicSignup();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isClinicSignup || !currentClinicId) { setPending(false); return; }
    (async () => {
      const { data } = await supabase
        .from('clinics')
        .select('is_published')
        .eq('id', currentClinicId)
        .maybeSingle();
      if (cancelled) return;
      setPending(!(data as any)?.is_published);
    })();
    return () => { cancelled = true; };
  }, [isClinicSignup, currentClinicId, location.pathname]);

  if (!pending) return null;
  if (location.pathname.startsWith('/settings')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      className="w-full flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left hover:bg-warning/15 transition-colors mb-4"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-warning" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Credenciamento pendente
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Preencha as informações obrigatórias em Configurações para publicar sua clínica e ficar disponível na Redes Medicas.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}