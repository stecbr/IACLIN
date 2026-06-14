import { useAuth } from '@/contexts/AuthContext';

/**
 * Detecta usuários que se cadastraram diretamente como "Clínica"
 * (fluxo do botão "Sou uma Clínica" em /auth). NÃO inclui médicos
 * que criaram clínicas depois pela área "Minhas Clínicas".
 */
export function useIsClinicSignup(): boolean {
  const { user } = useAuth();
  const meta = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
  return meta.user_type === 'clinica';
}