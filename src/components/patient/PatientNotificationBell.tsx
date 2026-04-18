import { useState } from 'react';
import { Bell, Calendar, DollarSign, Info, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePatientNotifications } from '@/hooks/usePatientNotifications';

const typeIcons: Record<string, typeof Bell> = {
  appointment: Calendar,
  financial: DollarSign,
  info: Info,
};

const typeColors: Record<string, string> = {
  appointment: 'text-blue-500 bg-blue-500/10',
  financial: 'text-emerald-500 bg-emerald-500/10',
  info: 'text-primary bg-primary/10',
};

export function PatientNotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePatientNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
          title="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1 animate-in zoom-in-50">
              {unreadCount > 9 ? '9+' : unreadCount}
              <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-20" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[440px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcons[n.type] ?? Bell;
              const color = typeColors[n.type] ?? 'text-muted-foreground bg-muted';
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 ${
                    !n.read ? 'bg-primary/[0.03]' : ''
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${!n.read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                        {n.title}
                      </p>
                      {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                    )}
                    <time className="text-[10px] text-muted-foreground/60 mt-1 block">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </time>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
