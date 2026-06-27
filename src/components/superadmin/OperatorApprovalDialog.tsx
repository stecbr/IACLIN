import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Mail, Phone, User, Hash, Building2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import iaclinLogo from "@/assets/iaclin-logo.png.asset.json";

interface Operator {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  ans_code: string | null;
  type: string;
  contact_email: string | null;
  contact_phone: string | null;
  responsible_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  is_active: boolean;
  created_at: string;
  approval_status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  reviewed_at?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  medico: "Médico",
  odonto: "Odontológico",
  ambos: "Médico + Odonto",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Em análise", cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300" },
  approved: { label: "Aprovada", cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "Recusada", cls: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300" },
};

interface Props {
  operator: Operator | null;
  onOpenChange: (open: boolean) => void;
}

export function OperatorApprovalDialog({ operator, onOpenChange }: Props) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"view" | "reject">("view");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (vars: { status: "approved" | "rejected"; reason?: string }) => {
      if (!operator) throw new Error("no operator");
      const { data, error } = await (supabase as any).rpc("admin_set_operator_approval", {
        _operator_id: operator.id,
        _status: vars.status,
        _reason: vars.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "approved" ? "Operadora aprovada" : "Operadora recusada");
      qc.invalidateQueries({ queryKey: ["platform-operators"] });
      setReason("");
      setMode("view");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao atualizar status"),
  });

  if (!operator) return null;
  const status = operator.approval_status ?? "pending";
  const badge = STATUS_BADGE[status];

  return (
    <Dialog open={!!operator} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src={operator.logo_url || iaclinLogo.url}
              alt={operator.name}
              className="h-12 w-12 rounded object-contain border bg-white p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = iaclinLogo.url; }}
            />
            <div className="flex-1 text-left">
              <DialogTitle className="flex items-center gap-2">
                {operator.name}
                <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
              </DialogTitle>
              {operator.legal_name && operator.legal_name !== operator.name && (
                <DialogDescription>{operator.legal_name}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Building2} label="CNPJ" value={operator.cnpj} mono />
            <InfoRow icon={Hash} label="Código ANS" value={operator.ans_code} mono />
            <InfoRow icon={Building2} label="Tipo" value={TYPE_LABELS[operator.type] ?? operator.type} />
            <InfoRow icon={User} label="Responsável" value={operator.responsible_name} />
            <InfoRow icon={Mail} label="E-mail" value={operator.contact_email} />
            <InfoRow icon={Phone} label="Telefone" value={operator.contact_phone} />
            <InfoRow icon={Clock} label="Cadastro" value={format(new Date(operator.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} />
            {operator.reviewed_at && (
              <InfoRow icon={Clock} label="Revisado em" value={format(new Date(operator.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} />
            )}
          </div>

          {status === "rejected" && operator.rejection_reason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm">
              <p className="font-medium text-rose-700 dark:text-rose-300 mb-1">Motivo da recusa</p>
              <p className="text-rose-700/90 dark:text-rose-300/90 whitespace-pre-wrap">{operator.rejection_reason}</p>
            </div>
          )}

          {mode === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da recusa</Label>
              <Textarea
                id="reason"
                placeholder="Explique o motivo para que a operadora possa entender..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {mode === "view" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              {status !== "rejected" && (
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  onClick={() => setMode("reject")}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Recusar
                </Button>
              )}
              {status !== "approved" && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ status: "approved" })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setMode("view"); setReason(""); }}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={mutation.isPending || !reason.trim()}
                onClick={() => mutation.mutate({ status: "rejected", reason: reason.trim() })}
              >
                Confirmar recusa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}