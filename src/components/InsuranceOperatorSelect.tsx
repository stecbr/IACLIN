import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const NONE_VALUE = '__none__';

interface InsuranceOperatorSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Select de operadoras de saúde (catálogo global).
 * Usado no signup e portal do paciente. Salva o NOME da operadora.
 */
export function InsuranceOperatorSelect({
  value,
  onChange,
  placeholder = 'Selecione a operadora',
  disabled,
  id,
  className,
}: InsuranceOperatorSelectProps) {
  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['insurance-operators-catalog'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_operators')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectValue = value && value.length > 0 ? value : NONE_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={isLoading ? 'Carregando...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>Nenhum (Particular)</SelectItem>
        {operators.map((op) => (
          <SelectItem key={op.id} value={op.name}>{op.name}</SelectItem>
        ))}
        {/* Compat: valor antigo que não bate com catálogo */}
        {value && !operators.some((op) => op.name === value) && (
          <SelectItem value={value}>{value} (atual)</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}