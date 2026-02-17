'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/types/transaction';

const PAGE_SIZE = 100;

export interface YearMonth {
  year: number;
  month: number;
  label: string; // "2026年2月"
}

export function useTransactions() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 年月フィルタ
  const [yearMonth, setYearMonth] = useState<string | null>(null); // "2026-02" or null
  const [yearMonthOptions, setYearMonthOptions] = useState<YearMonth[]>([]);

  // 年月の選択肢を取得（全取引の transaction_date から重複なしの年月リスト）
  const fetchYearMonths = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('transactions')
      .select('transaction_date')
      .not('transaction_date', 'is', null)
      .order('transaction_date', { ascending: false });

    if (err || !data) return;

    const seen = new Set<string>();
    const options: YearMonth[] = [];

    for (const row of data) {
      if (!row.transaction_date) continue;
      const key = row.transaction_date.substring(0, 7); // "2026-02"
      if (seen.has(key)) continue;
      seen.add(key);
      const [y, m] = key.split('-').map(Number);
      options.push({ year: y, month: m, label: `${y}年${m}月` });
    }

    setYearMonthOptions(options);
  }, [supabase]);

  // メインの取引データ取得（ページネーション＋年月フィルタ対応）
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    // 年月フィルタ
    if (yearMonth) {
      const start = `${yearMonth}-01`;
      const [y, m] = yearMonth.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      query = query.gte('transaction_date', start).lt('transaction_date', nextMonth);
    }

    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error: err, count } = await query;

    if (err) {
      setError(err.message);
    } else {
      setTransactions(data ?? []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [supabase, page, yearMonth]);

  useEffect(() => {
    fetchYearMonths();
  }, [fetchYearMonths]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // 年月変更時はページを1に戻す
  const changeYearMonth = useCallback((ym: string | null) => {
    setYearMonth(ym);
    setPage(1);
  }, []);

  const insert = async (records: Partial<Transaction>[], uploadLogId?: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const rows = records.map((r) => ({
      user_id: user.id,
      transaction_date: r.transaction_date || null,
      slip_number: r.slip_number || null,
      transaction_content: r.transaction_content || null,
      payment_type: r.payment_type || null,
      terminal_number: r.terminal_number || null,
      card_brand: r.card_brand || null,
      amount: r.amount || 0,
      clerk: r.clerk || null,
      confidence: r.confidence || 'medium',
      file_name: r.file_name || null,
      upload_log_id: uploadLogId || null,
    }));

    const { data, error: err } = await supabase
      .from('transactions')
      .insert(rows)
      .select();

    if (err) throw err;

    // 挿入後はリフレッシュ（年月リストも更新される可能性あり）
    await fetchYearMonths();
    await fetch();
    return data;
  };

  const update = async (id: string, fields: Partial<Transaction>) => {
    const { error: err } = await supabase
      .from('transactions')
      .update(fields)
      .eq('id', id);

    if (err) throw err;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...fields } : t))
    );
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (err) throw err;

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setTotalCount((prev) => prev - 1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return {
    transactions,
    loading,
    error,
    refetch: fetch,
    insert,
    update,
    remove,
    // ページネーション
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize: PAGE_SIZE,
    // 年月フィルタ
    yearMonth,
    changeYearMonth,
    yearMonthOptions,
  };
}
