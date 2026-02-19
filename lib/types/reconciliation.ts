import type { PaymentCategory } from '@/lib/utils/normalize';

export interface ReconciliationPeriod {
  id: string;
  user_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  period_type: 'first_half' | 'second_half' | 'full_month';
  expected_payment_date: string | null;
  status: 'open' | 'reconciling' | 'archived';
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationEntry {
  id: string;
  period_id: string;
  user_id: string;
  group_label: string;
  expected_amount: number;
  actual_amount: number;
  difference: number;
  carryover_amount: number;
  fee_amount: number;
  payment_status: 'pending' | 'received' | 'partial' | 'overdue' | 'written_off';
  status: 'pending' | 'matched' | 'mismatched' | 'resolved';
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * group_label "VJ協|一括" → { group: "VJ協", category: "一括" }
 */
export function parseGroupLabel(label: string): { group: string; category: PaymentCategory } {
  const idx = label.indexOf('|');
  if (idx === -1) return { group: label, category: '一括' };
  const group = label.substring(0, idx);
  const cat = label.substring(idx + 1) as PaymentCategory;
  return { group, category: cat || '一括' };
}

/**
 * 差引残 = 売上合計 + 繰越 − 入金額 − 手数料
 */
export function computeBalance(e: ReconciliationEntry): number {
  return e.actual_amount + e.carryover_amount - e.expected_amount - e.fee_amount;
}
