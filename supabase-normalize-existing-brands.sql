-- 既存データのcard_brandをマスタの正規名に一括変換
-- card_brand_master の aliases を使って動的にマッピング

UPDATE public.transactions t
SET card_brand = m.name,
    updated_at = now()
FROM public.card_brand_master m
WHERE t.card_brand IS NOT NULL
  AND t.card_brand != m.name
  AND (
    -- エイリアス一致（大文字小文字無視）
    LOWER(t.card_brand) = ANY(SELECT LOWER(a) FROM UNNEST(m.aliases) a)
    -- または旧名がマスタ名そのもの（大文字小文字の揺れ）
    OR (LOWER(t.card_brand) = LOWER(m.name) AND t.card_brand != m.name)
  );

-- 確認用：変換後のcard_brand一覧
-- SELECT card_brand, COUNT(*) FROM public.transactions GROUP BY card_brand ORDER BY count DESC;
