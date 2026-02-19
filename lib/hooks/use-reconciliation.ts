'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { classifyPaymentCategory } from '@/lib/utils/normalize';
import type { ReconciliationPeriod, ReconciliationEntry } from '@/lib/types/reconciliation';
import { computeBalance } from '@/lib/types/reconciliation';

export interface BrandBreakdown {
  brand: string;
  amount: number;
}

export interface GroupActual {
  groupLabel: string; // "VJ協|一括"
  totalAmount: number;
  brands: BrandBreakdown[];
}

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

  /**
   * 前半/後半期間を作成
   */
  const createPeriod = async (
    year: number,
    month: number, // 1-indexed
    periodType: 'first_half' | 'second_half'
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();

    let start: string;
    let end: string;
    let expectedPaymentDate: string;
    let label: string;

    if (periodType === 'first_half') {
      start = `${year}-${mm}-01`;
      end = `${year}-${mm}-15`;
      // 入金予定日: 当月末
      expectedPaymentDate = `${year}-${mm}-${lastDay}`;
      label = `${year}年${month}月 前半（1〜15日）`;
    } else {
      start = `${year}-${mm}-16`;
      end = `${year}-${mm}-${lastDay}`;
      // 入金予定日: 翌月15日
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      expectedPaymentDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
      label = `${year}年${month}月 後半（16〜${lastDay}日）`;
    }

    const { data, error } = await supabase
      .from('reconciliation_periods')
      .insert({
        user_id: user.id,
        period_label: label,
        period_start: start,
        period_end: end,
        period_type: periodType,
        expected_payment_date: expectedPaymentDate,
      })
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

    // Delete entries first (foreign key)
    await supabase
      .from('reconciliation_entries')
      .delete()
      .eq('period_id', id);

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
          carryover_amount: entry.carryover_amount ?? 0,
          fee_amount: entry.fee_amount ?? 0,
          payment_status: entry.payment_status ?? 'pending',
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
          carryover_amount: entry.carryover_amount ?? 0,
          fee_amount: entry.fee_amount ?? 0,
          payment_status: entry.payment_status ?? 'pending',
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

  /**
   * 対象期間のトランザクションを集計
   * → 入金先×支払区分の組み合わせで行を生成
   * → ブランド別内訳も返す
   * → 0円グループは自動除外（0円バグ修正）
   */
  const computeActuals = async (
    periodStart: string,
    periodEnd: string,
    getBrandGroup: (brand: string | null) => string
  ): Promise<GroupActual[]> => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('card_brand, amount, transaction_content, payment_type, installment_count')
      .gte('transaction_date', periodStart)
      .lte('transaction_date', periodEnd);

    // グループ×カテゴリ別に集計
    const groupMap: Record<string, { total: number; brands: Record<string, number> }> = {};

    for (const t of txns ?? []) {
      const group = getBrandGroup(t.card_brand);
      const category = classifyPaymentCategory(t.payment_type, t.installment_count ?? 1);
      const label = `${group}|${category}`;
      const sign = t.transaction_content === '取消' || t.transaction_content === '返品' ? -1 : 1;
      const amount = (t.amount || 0) * sign;

      if (!groupMap[label]) {
        groupMap[label] = { total: 0, brands: {} };
      }
      groupMap[label].total += amount;

      const brandName = t.card_brand || '不明';
      groupMap[label].brands[brandName] = (groupMap[label].brands[brandName] || 0) + amount;
    }

    // GroupActual[]に変換（0円グループはスキップ）
    const result: GroupActual[] = [];
    for (const [label, data] of Object.entries(groupMap)) {
      if (data.total === 0) continue;

      const brands: BrandBreakdown[] = Object.entries(data.brands)
        .map(([brand, amount]) => ({ brand, amount }))
        .sort((a, b) => b.amount - a.amount);

      result.push({ groupLabel: label, totalAmount: data.total, brands });
    }

    // ソート: グループ名→カテゴリ順
    const categoryOrder: Record<string, number> = { '一括': 0, '2回': 1, 'その他': 2, 'ボーナス': 3 };
    result.sort((a, b) => {
      const [gA, cA] = a.groupLabel.split('|');
      const [gB, cB] = b.groupLabel.split('|');
      const groupCompare = gA.localeCompare(gB, 'ja');
      if (groupCompare !== 0) return groupCompare;
      return (categoryOrder[cA] ?? 9) - (categoryOrder[cB] ?? 9);
    });

    return result;
  };

  /**
   * 直前の期間から繰越額を取得
   * group_label 単位で差引残>0のものを返す
   */
  const getCarryovers = async (
    currentPeriodStart: string
  ): Promise<Record<string, number>> => {
    // 現在の期間より前の期間を開始日降順で取得
    const { data: prevPeriods } = await supabase
      .from('reconciliation_periods')
      .select('*, reconciliation_entries(*)')
      .lt('period_start', currentPeriodStart)
      .order('period_start', { ascending: false })
      .limit(1);

    const carryovers: Record<string, number> = {};

    if (prevPeriods && prevPeriods.length > 0) {
      const prevEntries = (prevPeriods[0] as PeriodWithEntries).reconciliation_entries || [];
      for (const e of prevEntries) {
        const balance = computeBalance(e);
        if (balance > 0) {
          carryovers[e.group_label] = balance;
        }
      }
    }

    return carryovers;
  };

  return {
    periods,
    loading,
    refetch: fetch,
    createPeriod,
    updatePeriod,
    deletePeriod,
    upsertEntry,
    archivePeriod,
    computeActuals,
    getCarryovers,
  };
}
