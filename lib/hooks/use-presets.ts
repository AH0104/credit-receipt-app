'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AggregationPreset, PresetInsert } from '@/lib/types/aggregation';

export function usePresets() {
  const supabase = createClient();
  const [presets, setPresets] = useState<AggregationPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('aggregation_presets')
      .select('*')
      .order('display_order', { ascending: true });

    setPresets(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (preset: Omit<PresetInsert, 'user_id'>) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const { data, error } = await supabase
      .from('aggregation_presets')
      .insert({ ...preset, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    setPresets((prev) => [...prev, data]);
    return data;
  };

  const update = async (id: string, fields: Partial<AggregationPreset>) => {
    const { error } = await supabase
      .from('aggregation_presets')
      .update(fields)
      .eq('id', id);

    if (error) throw error;

    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...fields } : p))
    );
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from('aggregation_presets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return { presets, loading, refetch: fetch, create, update, remove };
}
