'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CardBrandMaster } from '@/lib/types/card-brand-master';

export function useCardBrandMaster() {
  const supabase = createClient();
  const [brands, setBrands] = useState<CardBrandMaster[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('card_brand_master')
      .select('*')
      .order('sort_order');
    setBrands(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (brand: Partial<CardBrandMaster> & { name: string; aliases: string[] }) => {
    if (brand.id) {
      const { error } = await supabase
        .from('card_brand_master')
        .update({ name: brand.name, aliases: brand.aliases, sort_order: brand.sort_order ?? 0 })
        .eq('id', brand.id);
      if (error) throw error;
    } else {
      const nextOrder = brands.length > 0 ? Math.max(...brands.map(b => b.sort_order)) + 1 : 1;
      const { error } = await supabase
        .from('card_brand_master')
        .insert({ name: brand.name, aliases: brand.aliases, sort_order: brand.sort_order ?? nextOrder });
      if (error) throw error;
    }
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('card_brand_master').delete().eq('id', id);
    if (error) throw error;
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  /** エイリアスからマスタ名に変換。マッチしなければ入力値をそのまま返す */
  const resolveAlias = useCallback((raw: string | null): string | null => {
    if (!raw) return null;
    const normalized = raw.trim();
    // まず name 完全一致
    const exact = brands.find(b => b.name === normalized);
    if (exact) return exact.name;
    // aliases を検索（大文字小文字無視）
    const lower = normalized.toLowerCase();
    for (const b of brands) {
      if (b.name.toLowerCase() === lower) return b.name;
      for (const alias of b.aliases) {
        if (alias.toLowerCase() === lower) return b.name;
      }
    }
    return normalized;
  }, [brands]);

  return { brands, loading, upsert, remove, refetch: fetch, resolveAlias };
}
