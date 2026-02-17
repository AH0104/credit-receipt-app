'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/types/transaction';

export function useTransactions() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setTransactions(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetch();
  }, [fetch]);

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

    setTransactions((prev) => [...(data ?? []), ...prev]);
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
  };

  return { transactions, loading, error, refetch: fetch, insert, update, remove };
}
