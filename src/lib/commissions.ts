import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a commission expense transaction (or transactions) when a
 * revenue financial_transaction reaches a state that satisfies the
 * configured commission rules of its dentist.
 *
 * Triggers:
 *   - "after_procedure": fired when the income transaction becomes approved
 *     (or is inserted as approved). Even if it's still status=pending.
 *   - "after_payment": fired when status moves to "paid".
 *
 * Idempotency: we look for an existing expense row with category='commission',
 * the same dentist_id, and the same rule id encoded in `notes`. If found, skip.
 *
 * Returns the number of commission rows inserted.
 */
export async function generateCommissionsForTransaction(
  txId: string,
  trigger: 'after_procedure' | 'after_payment'
): Promise<number> {
  if (!txId) return 0;

  const { data: tx, error } = await supabase
    .from('financial_transactions')
    .select(
      'id, clinic_id, dentist_id, appointment_id, amount, type, status, approval_status, category, patients(insurance_provider)'
    )
    .eq('id', txId)
    .maybeSingle();
  if (error || !tx) return 0;
  if (tx.type !== 'income') return 0;
  if (!tx.clinic_id || !tx.dentist_id) return 0;
  if (tx.approval_status && tx.approval_status !== 'approved') return 0;

  const { data: rules } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('clinic_id', tx.clinic_id)
    .eq('dentist_id', tx.dentist_id)
    .eq('trigger', trigger);
  let effectiveRules = rules ?? [];

  // Fallback: regra padrão da clínica quando o profissional não tem regra própria.
  if (effectiveRules.length === 0) {
    const { data: defaults } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('clinic_id', tx.clinic_id)
      .eq('is_clinic_default', true)
      .eq('trigger', trigger);
    effectiveRules = defaults ?? [];
  }
  if (effectiveRules.length === 0) return 0;

  // Pull professional specialty once (for specialty filtering)
  let memberSpecialty: string | null = null;
  const { data: member } = await supabase
    .from('clinic_members')
    .select('specialty')
    .eq('clinic_id', tx.clinic_id)
    .eq('user_id', tx.dentist_id)
    .maybeSingle();
  memberSpecialty = member?.specialty ?? null;

  const txInsurance = (tx as any).patients?.insurance_provider ?? null;
  const amount = Number(tx.amount) || 0;

  let created = 0;

  for (const rule of effectiveRules as any[]) {
    if (rule.insurance_provider && rule.insurance_provider !== txInsurance) continue;
    if (rule.specialty && rule.specialty !== memberSpecialty) continue;

    const commissionAmount =
      rule.type === 'percentage'
        ? amount * (Number(rule.value) / 100)
        : Number(rule.value);
    if (!commissionAmount || commissionAmount <= 0) continue;

    // Idempotency: skip if a commission for this specific transaction + rule already exists.
    const ruleTag = `[rule:${rule.id}]`;
    const { data: existing } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('clinic_id', tx.clinic_id)
      .eq('dentist_id', tx.dentist_id)
      .eq('category', 'commission')
      .ilike('notes', `%[rule:${rule.id}]%`)
      .ilike('notes', `%Origem tx ${tx.id}%`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const today = new Date().toISOString().slice(0, 10);
    const { error: insertErr } = await supabase.from('financial_transactions').insert({
      clinic_id: tx.clinic_id,
      dentist_id: tx.dentist_id,
      appointment_id: tx.appointment_id,
      type: 'expense',
      category: 'commission',
      description: `Comissão sobre atendimento`,
      amount: Number(commissionAmount.toFixed(2)),
      status: 'pending',
      due_date: today,
      payment_method: null,
      card_fee_amount: 0,
      approval_status: 'approved',
      notes:
        `${ruleTag} Origem tx ${tx.id} · ` +
        (rule.type === 'percentage'
          ? `${rule.value}% de ${amount.toFixed(2)}`
          : `valor fixo R$ ${Number(rule.value).toFixed(2)}`),
    });
    if (insertErr) throw insertErr;
    created++;
  }

  return created;
}
