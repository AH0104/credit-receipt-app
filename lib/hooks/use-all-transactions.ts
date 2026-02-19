'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/types/transaction';

/**
 * 全取引データを一括取得するフック（集計・ピボット用）
 * ページネーションなし。Supabase の 1000 件制限を回避するため全件ループ取得。
 */
export function useAllTransactions() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const PAGE = 1000;
    let all: Transaction[] = [];
    let from = 0;

    // Supabase は1リクエストあたり最大1000件。ループで全件取得
    while (true) {
      const { data, error: err } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (err) {
        setError(err.message);
        break;
      }

      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break; // 最終ページ
      from += PAGE;
    }

    setTransactions(all);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { transactions, loading, error, refetch: fetchAll };
}
