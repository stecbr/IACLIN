import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  illustration?: 'tooth' | 'calendar' | 'money' | 'generic';
}

function ToothIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-60">
      <defs>
        <linearGradient id="tooth-grad" x1="20" y1="10" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M40 8C30 8 22 14 20 24C18 34 16 42 22 52C26 58 28 68 30 72C32 76 36 76 38 72C39 68 40 64 40 64C40 64 41 68 42 72C44 76 48 76 50 72C52 68 54 58 58 52C64 42 62 34 60 24C58 14 50 8 40 8Z" fill="url(#tooth-grad)" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 28C36 24 44 24 48 28" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-60">
      <defs>
        <linearGradient id="cal-grad" x1="12" y1="12" x2="68" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="12" y="18" width="56" height="50" rx="8" fill="url(#cal-grad)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <path d="M12 30H68" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <rect x="28" y="12" width="2" height="12" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
      <rect x="50" y="12" width="2" height="12" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
      <circle cx="30" cy="44" r="3" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="40" cy="44" r="3" fill="hsl(var(--primary))" opacity="0.5" />
      <circle cx="50" cy="44" r="3" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="30" cy="56" r="3" fill="hsl(var(--primary))" opacity="0.2" />
      <circle cx="40" cy="56" r="3" fill="hsl(var(--primary))" opacity="0.2" />
    </svg>
  );
}

function MoneyIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-60">
      <defs>
        <linearGradient id="money-grad" x1="10" y1="20" x2="70" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="10" y="22" width="60" height="36" rx="6" fill="url(#money-grad)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="10" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
      <text x="40" y="45" textAnchor="middle" fill="hsl(var(--primary))" fontSize="14" fontWeight="600" opacity="0.6">$</text>
      <circle cx="20" cy="40" r="3" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
      <circle cx="60" cy="40" r="3" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

const illustrations = {
  tooth: ToothIllustration,
  calendar: CalendarIllustration,
  money: MoneyIllustration,
  generic: null,
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, children, illustration = 'generic' }: EmptyStateProps) {
  const Illustration = illustrations[illustration];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border border-dashed border-border/40 bg-gradient-to-b from-muted/30 to-muted/10 animate-fade-in">
      {Illustration ? (
        <div className="mb-6">
          <Illustration />
        </div>
      ) : (
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5 shadow-sm">
          <Icon className="h-7 w-7 text-primary/70" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-5 gap-2 rounded-xl shadow-sm">
          <Icon className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
