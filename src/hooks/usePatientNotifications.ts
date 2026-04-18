import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PatientNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export function usePatientNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['patient-notifications', user?.id];

  const { data: notifications = [] } = useQuery({
    queryKey: key,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      return (data ?? []) as PatientNotification[];
    },
  });

  // Realtime: notifications inserts + appointment changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`patient-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as PatientNotification;
          toast(n.title, { description: n.message ?? undefined });
          queryClient.invalidateQueries({ queryKey: key });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['patient-data', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const ids = notifications.filter((n) => !n.read).map((n) => n.id);
      if (ids.length === 0) return;
      await supabase.from('notifications').update({ read: true }).in('id', ids);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    notifications,
    unreadCount,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
  };
}
