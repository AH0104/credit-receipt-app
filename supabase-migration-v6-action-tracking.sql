-- =============================================================
-- Migration v6: 操作履歴トラッキング（アップロード・修正・金額確定）
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================
-- transactions テーブルに、各操作の実行者名と日時を記録するカラムを追加します。
-- - uploaded_by_name / uploaded_at : アップロード（登録）者と日時
-- - modified_by_name / modified_at : 最終修正者と日時
-- - confirmed_by_name / confirmed_at : 金額確定者と日時
-- =============================================================

-- 1. アップロード（登録）者の記録
alter table public.transactions
  add column if not exists uploaded_by_name text,
  add column if not exists uploaded_at timestamptz;

-- 2. 最終修正者の記録
alter table public.transactions
  add column if not exists modified_by_name text,
  add column if not exists modified_at timestamptz;

-- 3. 金額確定者の記録
alter table public.transactions
  add column if not exists confirmed_by_name text,
  add column if not exists confirmed_at timestamptz;

-- 4. 既存データに対してデフォルト値を設定（created_at を uploaded_at として利用）
update public.transactions
  set uploaded_at = created_at
  where uploaded_at is null;

-- ※ uploaded_by_name は既存データについては null のまま（遡及不可）
-- ※ modified_by_name / modified_at は未修正レコードは null のまま
-- ※ confirmed_by_name / confirmed_at は未確定レコードは null のまま
