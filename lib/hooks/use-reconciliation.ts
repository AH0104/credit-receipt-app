'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ReconciliationPeriod, ReconciliationEntry } from '@/lib/types/reconciliation';

export interface PeriodWithEntries extends ReconciliationPeriod {
  reconciliation_entries: ReconciliationEntry[];
}

export function useReconciliation() {
  const supabase = createClient();
  const [periods, setPeriods] = useState<PeriodWithEntries[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reconciliation_periods')
      .select('*, reconciliation_entries(*)')
      .order('period_start', { ascending: false });
    setPeriods((data as PeriodWithEntries[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const createPeriod = async (label: string, start: string, end: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const { data, error } = await supabase
      .from('reconciliation_periods')
      .insert({ user_id: user.id, period_label: label, period_start: start, period_end: end })
      .select()
      .single();
    if (error) throw error;
    await fetch();
    return data as ReconciliationPeriod;
  };

  const updatePeriod = async (id: string, fields: Partial<ReconciliationPeriod>) => {
    const { error } = await supabase
      .from('reconciliation_periods')
      .update(fields)
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deletePeriod = async (id: string) => {
    // Unarchive transactions first
    await supabase
      .from('transactions')
      .update({ archived_period_id: null })
      .eq('archived_period_id', id);

    const { error } = await supabase
      .from('reconciliation_periods')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const upsertEntry = async (entry: Partial<ReconciliationEntry> & { period_id: string; group_label: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    if (entry.id) {
      const { error } = await supabase
        .from('reconciliation_entries')
        .update({
          expected_amount: entry.expected_amount ?? 0,
          actual_amount: entry.actual_amount ?? 0,
          status: entry.status ?? 'pending',
          note: entry.note ?? null,
        })
        .eq('id', entry.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('reconciliation_entries')
        .insert({
          period_id: entry.period_id,
          user_id: user.id,
          group_label: entry.group_label,
          expected_amount: entry.expected_amount ?? 0,
          actual_amount: entry.actual_amount ?? 0,
        });
      if (error) throw error;
    }
    await fetch();
  };

  const archivePeriod = async (periodId: string, periodStart: string, periodEnd: string) => {
    // Mark matching transactions as archived (all users' data)
    await supabase
      .from('transactions')
      .update({ archived_period_id: periodId })
      .gte('transaction_date', periodStart)
      .lte('transaction_date', periodEnd)
      .is('archived_period_id', null);

    await supabase
      .from('reconciliation_periods')
      .update({ status: 'archived', confirmed_at: new Date().toISOString() })
      .eq('id', periodId);

    await fetch();
  };

  // Compute actual amounts for a period from transactions
  const computeActuals = async (
    periodStart: string,
    periodEnd: string,
    getBrandGroup: (brand: string | null) => string
  ) => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('card_brand, amount, transaction_content')
      .gte('transaction_date', periodStart)
      .lte('transaction_date', periodEnd);

    const groupTotals: Record<string, number> = {};
    for (const t of txns ?? []) {
      const group = getBrandGroup(t.card_brand);
      const sign = t.transaction_content === '取消' || t.transaction_content === '返品' ? -1 : 1;
      groupTotals[group] = (groupTotals[group] || 0) + (t.amount || 0) * sign;
    }
    return groupTotals;
  };

  return { periods, loading, refetch: fetch, createPeriod, updatePeriod, deletePeriod, upsertEntry, archivePeriod, computeActuals };
}
