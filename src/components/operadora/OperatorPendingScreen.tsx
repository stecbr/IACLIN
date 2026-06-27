import { Clock, XCircle, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  status: "pending" | "rejected";
  operatorName: string | null;
  reason: string | null;
}

export function OperatorPendingScreen({ status, operatorName, reason }: Props) {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const isRejected = status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
            isRejected
              ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {isRejected ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isRejected ? "Cadastro recusado" : "Cadastro em análise"}
          </h1>
          {operatorName && (
            <p className="text-sm text-muted-foreground">{operatorName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? "Seu cadastro de operadora não foi aprovado pela equipe IACLIN."
              : "Recebemos seu cadastro. Nossa equipe está revisando as informações e em breve liberaremos seu acesso."}
          </p>
          {isRejected && reason && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-left">
              <p className="font-medium text-rose-700 dark:text-rose-300 mb-1">Motivo</p>
              <p className="text-rose-700/90 dark:text-rose-300/90 whitespace-pre-wrap">{reason}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["my-operator-status"] })}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Verificar novamente
          </Button>
          <Button variant="ghost" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}