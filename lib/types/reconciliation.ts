export interface ReconciliationPeriod {
  id: string;
  user_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
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
  status: 'pending' | 'matched' | 'mismatched' | 'resolved';
  note: string | null;
  created_at: string;
  updated_at: string;
}
