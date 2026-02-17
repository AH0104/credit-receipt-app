'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AggregationPreset, AggregationResult } from '@/lib/types/aggregation';

export function useAggregation() {
  const supabase = createClient();
  const [results, setResults] = useState<AggregationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAggregation = async (
    preset: AggregationPreset,
    dateFrom?: string | null,
    dateTo?: string | null
  ) => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('認証されていません');
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase.rpc('aggregate_transactions', {
      p_user_id: user.id,
      p_group_by: preset.group_by,
      p_aggregations: preset.aggregations,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
    });

    if (err) {
      setError(err.message);
      setResults([]);
    } else {
      setResults((data as AggregationResult[]) ?? []);
    }

    setLoading(false);
  };

  return { results, loading, error, runAggregation };
}
