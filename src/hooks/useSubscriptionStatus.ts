import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionStatus = 'active' | 'trialing' | 'overdue' | 'cancelled' | 'none';

export interface SubscriptionStatusResult {
  status: SubscriptionStatus;
  isActive: boolean;
  isTrial: boolean;
  isOverdueOrCancelled: boolean;
  daysUntilDue: number | null;
  currentPeriodEnd: Date | null;
  hasSubscription: boolean;
  isLoading: boolean;
  refetch: () => void;
}

function normalizeStatus(raw: string | null | undefined): SubscriptionStatus {
  if (!raw) return 'none';
  const s = raw.toLowerCase();
  if (s === 'trial' || s === 'trialing') return 'trialing';
  if (s === 'active') return 'active';
  if (s === 'overdue' || s === 'past_due' || s === 'unpaid') return 'overdue';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'none';
}

export function useSubscriptionStatus(): SubscriptionStatusResult {
  const { currentClinicId, isPersonalMode } = useAuth();

  const enabled = !!currentClinicId && !isPersonalMode;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subscription-status', currentClinicId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_subscriptions')
        .select('status, current_period_end')
        .eq('entity_type', 'clinic')
        .eq('entity_id', currentClinicId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const status = normalizeStatus((data as { status?: string } | null)?.status);
  const periodEndRaw = (data as { current_period_end?: string } | null)?.current_period_end ?? null;
  const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : null;

  let daysUntilDue: number | null = null;
  if (currentPeriodEnd) {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    daysUntilDue = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / msPerDay);
  }

  return {
    status,
    isActive: status === 'active' || status === 'trialing',
    isTrial: status === 'trialing',
    isOverdueOrCancelled: status === 'overdue' || status === 'cancelled',
    daysUntilDue,
    currentPeriodEnd,
    hasSubscription: !!data,
    isLoading: enabled && isLoading,
    refetch,
  };
}