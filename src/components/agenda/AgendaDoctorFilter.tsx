import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Check, Columns3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';

export type DoctorFilterValue =
  | { kind: 'all' }
  | { kind: 'one'; doctorId: string }
  | { kind: 'compare' };

export interface DoctorOption {
  user_id: string;
  full_name: string;
}

interface Props {
  value: DoctorFilterValue;
  onChange: (value: DoctorFilterValue) => void;
  allowCompare?: boolean;
  /** Visible to caller so it can render avatars on cards in "all" mode. */
  onDoctorsLoaded?: (doctors: DoctorOption[]) => void;
}

const STORAGE_KEY = 'iaclin.agendaDoctorFilter';

export function loadStoredDoctorFilter(): DoctorFilterValue {
  if (typeof window === 'undefined') return { kind: 'all' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: 'all' };
    const parsed = JSON.parse(raw);
    if (parsed?.kind === 'all' || parsed?.kind === 'compare') return parsed;
    if (parsed?.kind === 'one' && typeof parsed.doctorId === 'string') return parsed;
  } catch {}
  return { kind: 'all' };
}

export function persistDoctorFilter(value: DoctorFilterValue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

export function AgendaDoctorFilter({ value, onChange, allowCompare = true, onDoctorsLoaded }: Props) {
  const { currentClinicId } = useAuth();

  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async (): Promise<DoctorOption[]> => {
      const { data: members, error } = await supabase
        .from('clinic_members')
        .select('user_id, role')
        .eq('clinic_id', currentClinicId!)
        .in('role', ['admin', 'dentist']);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Sem nome']));
      return ids
        .map((id) => ({ user_id: id, full_name: byId.get(id) ?? 'Sem nome' }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  useEffect(() => {
    onDoctorsLoaded?.(doctors);
  }, [doctors, onDoctorsLoaded]);

  const selectedDoctor = useMemo(() => {
    if (value.kind !== 'one') return null;
    return doctors.find((d) => d.user_id === value.doctorId) ?? null;
  }, [value, doctors]);

  const triggerLabel =
    value.kind === 'all'
      ? 'Todos os médicos'
      : value.kind === 'compare'
      ? 'Comparar lado a lado'
      : selectedDoctor?.full_name ?? 'Médico';

  const handleSelect = (next: DoctorFilterValue) => {
    persistDoctorFilter(next);
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background text-sm font-medium hover:bg-muted/50 transition-colors"
          title="Filtrar por médico"
        >
          {value.kind === 'one' && selectedDoctor ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(selectedDoctor.user_id) }}
            >
              {getInitials(selectedDoctor.full_name)}
            </span>
          ) : (
            <Users className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[180px] truncate">{triggerLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Filtrar agenda</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleSelect({ kind: 'all' })} className="gap-2 cursor-pointer">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">Todos os médicos</span>
          {value.kind === 'all' && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        {doctors.length > 0 && <DropdownMenuSeparator />}
        {doctors.map((d) => {
          const active = value.kind === 'one' && value.doctorId === d.user_id;
          return (
            <DropdownMenuItem
              key={d.user_id}
              onClick={() => handleSelect({ kind: 'one', doctorId: d.user_id })}
              className="gap-2 cursor-pointer"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: getAvatarColor(d.user_id) }}
              >
                {getInitials(d.full_name)}
              </span>
              <span className="flex-1 text-sm truncate">{d.full_name}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        {allowCompare && doctors.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSelect({ kind: 'compare' })} className="gap-2 cursor-pointer">
              <Columns3 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">Comparar lado a lado</span>
              {value.kind === 'compare' && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}