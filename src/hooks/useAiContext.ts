import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// ============================================================
// useAiContext — Phase 1.0
// Resolve o ai_tenant_id de acordo com o contexto atual:
//   - clínica selecionada → tenant da clínica (RPC resolve_or_create_ai_tenant_for_clinic)
//   - modo profissional   → tenant do profissional (RPC resolve_or_create_ai_tenant_for_user)
// Mantém clinic_id para compatibilidade com fluxos existentes.
// ============================================================

export type AiContextKind = 'clinic' | 'professional';

export interface AiContext {
  ready: boolean;
  kind: AiContextKind | null;
  aiTenantId: string | null;
  clinicId: string | null;
  userId: string | null;
  displayName: string;
  // True quando o backend externo da IA já suporta este modo
  // (Phase 1.0: backend só fala "clinic"). Usado para esconder WhatsApp em pro.
  backendSupported: boolean;
}

export function useAiContext(): AiContext {
  const { user, currentClinicId, isPersonalMode, profile, clinics } = useAuth();
  const [aiTenantId, setAiTenantId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const kind: AiContextKind | null = currentClinicId
    ? 'clinic'
    : isPersonalMode && user
    ? 'professional'
    : null;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setAiTenantId(null);

    (async () => {
      if (!user || !kind) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        if (kind === 'clinic' && currentClinicId) {
          const { data, error } = await supabase.rpc(
            'resolve_or_create_ai_tenant_for_clinic',
            { _clinic_id: currentClinicId },
          );
          if (error) throw error;
          if (!cancelled) setAiTenantId((data as string) ?? null);
        } else if (kind === 'professional') {
          const { data, error } = await supabase.rpc(
            'resolve_or_create_ai_tenant_for_user',
            { _user_id: user.id },
          );
          if (error) throw error;
          if (!cancelled) setAiTenantId((data as string) ?? null);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[useAiContext] resolve falhou:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, currentClinicId, kind]);

  const clinicName = clinics.find((c) => c.clinic_id === currentClinicId)?.clinic_name;
  const displayName =
    kind === 'clinic'
      ? clinicName ?? 'Sua clínica'
      : profile?.full_name ?? 'Meu consultório';

  return {
    ready,
    kind,
    aiTenantId,
    clinicId: currentClinicId,
    userId: user?.id ?? null,
    displayName,
    backendSupported: kind === 'clinic',
  };
}
