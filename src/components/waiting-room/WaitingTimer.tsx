import { useEffect, useState } from 'react';

interface Props {
  /** ISO timestamp the timer counts from. */
  since: string;
  /** Optional className for the wrapper. */
  className?: string;
  /** Show short label (e.g. "12 min") vs full ("aguardando há 12 min"). */
  variant?: 'short' | 'full';
}

/**
 * Live timer that updates every 30s, showing how long ago `since` was.
 */
export function WaitingTimer({ since, className, variant = 'short' }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(since).getTime();
  const diffMs = Math.max(0, now - start);
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  const label =
    hours > 0 ? `${hours}h ${minutes}min` : minutes <= 0 ? 'agora' : `${minutes} min`;

  return (
    <span className={className}>
      {variant === 'full' ? `aguardando há ${label}` : label}
    </span>
  );
}