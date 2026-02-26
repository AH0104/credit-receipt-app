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

export type SortKey = 'transaction_date' | 'card_brand' | 'transaction_content' | 'amount' | 'slip_number' | 'payment_type' | 'terminal_number' | 'clerk' | 'created_at';
export type SortDir = 'asc' | 'desc';

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

  // カード会社フィルタ
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  // 区分フィルタ
  const [contentFilter, setContentFilter] = useState<string | null>(null);

  // ソート
  const [sortKey, setSortKey] = useState<SortKey>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  // メインの取引データ取得（ページネーション＋フィルタ＋ソート対応）
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

    // カード会社フィルタ
    if (brandFilter) {
      query = query.eq('card_brand', brandFilter);
    }

    // 区分フィルタ
    if (contentFilter) {
      query = query.eq('transaction_content', contentFilter);
    }

    // ソート（NULLは末尾に配置）
    const ascending = sortDir === 'asc';
    query = query
      .order(sortKey, { ascending, nullsFirst: false })
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
  }, [supabase, page, yearMonth, brandFilter, contentFilter, sortKey, sortDir]);

  useEffect(() => {
    fetchYearMonths();
  }, [fetchYearMonths]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // フィルタ・ソート変更時はページを1に戻す
  const changeYearMonth = useCallback((ym: string | null) => {
    setYearMonth(ym);
    setPage(1);
  }, []);

  const changeBrandFilter = useCallback((brand: string | null) => {
    setBrandFilter(brand);
    setPage(1);
  }, []);

  const changeContentFilter = useCallback((content: string | null) => {
    setContentFilter(content);
    setPage(1);
  }, []);

  const changeSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        // 同じキーなら方向トグル
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        // 新しいキーならデフォルト方向
        setSortDir(key === 'amount' ? 'desc' : 'asc');
      }
      return key;
    });
    setPage(1);
  }, []);

  const insert = async (records: Partial<Transaction>[], uploadLogId?: string, uploaderName?: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const now = new Date().toISOString();
    const rows = records.map((r) => ({
      user_id: user.id,
      transaction_date: r.transaction_date || null,
      slip_number: r.slip_number || null,
      transaction_content: r.transaction_content || null,
      payment_type: r.payment_type || null,
      terminal_number: r.terminal_number || null,
      card_brand: r.card_brand || null,
      amount: r.amount || 0,
      installment_count: r.installment_count ?? 1,
      clerk: r.clerk || null,
      confidence: r.confidence || 'medium',
      file_name: r.file_name || null,
      upload_log_id: uploadLogId || null,
      uploaded_by_name: uploaderName || null,
      uploaded_at: now,
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

  const update = async (id: string, fields: Partial<Transaction>, modifierName?: string) => {
    const now = new Date().toISOString();
    const updateFields: Record<string, any> = {
      ...fields,
      modified_by_name: modifierName || null,
      modified_at: now,
    };

    const { error: err } = await supabase
      .from('transactions')
      .update(updateFields)
      .eq('id', id);

    if (err) throw err;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updateFields } : t))
    );
  };

  const confirmAmount = async (id: string, confirmerName: string) => {
    const now = new Date().toISOString();
    const updateFields = {
      confirmed_by_name: confirmerName,
      confirmed_at: now,
    };

    const { error: err } = await supabase
      .from('transactions')
      .update(updateFields)
      .eq('id', id);

    if (err) throw err;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updateFields } : t))
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
    confirmAmount,
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
    // カード会社フィルタ
    brandFilter,
    changeBrandFilter,
    // 区分フィルタ
    contentFilter,
    changeContentFilter,
    // ソート
    sortKey,
    sortDir,
    changeSort,
  };
}
