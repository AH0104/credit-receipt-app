import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { normalizeText } from '@/lib/utils/normalize';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // editor/admin チェック
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !['admin', 'editor'].includes(profile.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // マスタ取得
    const { data: masterBrands } = await supabase
      .from('card_brand_master')
      .select('name, aliases');

    if (!masterBrands || masterBrands.length === 0) {
      return NextResponse.json({ updated: 0, message: 'マスタが空です' });
    }

    // エイリアス→正規名マップ構築
    const aliasMap = new Map<string, string>();
    for (const b of masterBrands) {
      aliasMap.set(b.name.toLowerCase(), b.name);
      for (const alias of b.aliases) {
        aliasMap.set(alias.toLowerCase(), b.name);
      }
    }

    // 対象トランザクション取得（card_brandが非NULLでマスタ名と一致しない物）
    const masterNames = new Set(masterBrands.map(b => b.name));
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, card_brand')
      .not('card_brand', 'is', null);

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ updated: 0, message: '対象データなし' });
    }

    // 変換が必要なレコードを抽出
    const updates: { id: string; newBrand: string }[] = [];
    for (const t of transactions) {
      if (masterNames.has(t.card_brand)) continue; // 既に正規名
      // テキスト正規化（半角カナ→全角、分離濁点結合）+ 括弧除去
      let cleaned = normalizeText(t.card_brand);
      cleaned = cleaned.replace(/\s*[\(（].*[\)）]$/, '').trim();
      // 正規化後にマスタ名と完全一致すればそれを採用
      if (masterNames.has(cleaned)) {
        updates.push({ id: t.id, newBrand: cleaned });
        continue;
      }
      // エイリアスで解決
      const mapped = aliasMap.get(cleaned.toLowerCase());
      if (mapped && mapped !== t.card_brand) {
        updates.push({ id: t.id, newBrand: mapped });
      }
    }

    // 一括更新
    let updated = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from('transactions')
        .update({ card_brand: u.newBrand, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (!error) updated++;
    }

    return NextResponse.json({
      updated,
      total: transactions.length,
      message: `${updated}件のカード会社名を変換しました`,
    });
  } catch (err: any) {
    console.error('Normalize brands error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
