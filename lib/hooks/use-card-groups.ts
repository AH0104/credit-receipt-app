'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CardBrandGroup } from '@/lib/types/card-group';

export function useCardGroups() {
  const supabase = createClient();
  const [groups, setGroups] = useState<CardBrandGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('card_brand_groups')
      .select('*')
      .order('sort_order');
    setGroups(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (group: Partial<CardBrandGroup> & { group_name: string; brands: string[] }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    if (group.id) {
      const { error } = await supabase
        .from('card_brand_groups')
        .update({ group_name: group.group_name, brands: group.brands, sort_order: group.sort_order ?? 0 })
        .eq('id', group.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('card_brand_groups')
        .insert({ user_id: user.id, group_name: group.group_name, brands: group.brands, sort_order: group.sort_order ?? 0 });
      if (error) throw error;
    }
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('card_brand_groups').delete().eq('id', id);
    if (error) throw error;
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  // Helper: map a card_brand to its group_name (or return brand as-is)
  const getBrandGroup = useCallback((brand: string | null): string => {
    if (!brand) return '不明';
    for (const g of groups) {
      if (g.brands.includes(brand)) return g.group_name;
    }
    return brand;
  }, [groups]);

  return { groups, loading, upsert, remove, refetch: fetch, getBrandGroup };
}
