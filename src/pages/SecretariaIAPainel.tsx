import { Navigate } from 'react-router-dom';

// O antigo painel foi consolidado dentro do hub em /secretaria-ia (aba "Painel").
// Mantemos a rota para não quebrar links externos / atalhos antigos.
export default function SecretariaIAPainel() {
  return <Navigate to="/secretaria-ia" replace />;
}
