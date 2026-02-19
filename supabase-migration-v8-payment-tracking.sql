-- =============================================================
-- Migration v8: 入金消込システム — 分割回数・期間タイプ・繰越・手数料
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================
-- 1. transactions に分割回数 (installment_count) を追加
-- 2. reconciliation_periods に期間タイプと入金予定日を追加
-- 3. reconciliation_entries に繰越額・手数料・入金ステータスを追加
-- =============================================================

-- =============================================================
-- 1. transactions テーブル: 分割回数
-- =============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1;

-- 既存データはデフォルト1（一括）
UPDATE public.transactions
  SET installment_count = 1
  WHERE installment_count IS NULL;

-- =============================================================
-- 2. reconciliation_periods テーブル: 期間タイプ + 入金予定日
-- =============================================================
ALTER TABLE public.reconciliation_periods
  ADD COLUMN IF NOT EXISTS period_type text DEFAULT 'full_month',
  ADD COLUMN IF NOT EXISTS expected_payment_date date;

-- CHECK制約を追加（既にある場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reconciliation_periods_period_type_check'
  ) THEN
    ALTER TABLE public.reconciliation_periods
      ADD CONSTRAINT reconciliation_periods_period_type_check
      CHECK (period_type IN ('first_half', 'second_half', 'full_month'));
  END IF;
END $$;

-- =============================================================
-- 3. reconciliation_entries テーブル: 繰越額・手数料・入金ステータス
-- =============================================================
ALTER TABLE public.reconciliation_entries
  ADD COLUMN IF NOT EXISTS carryover_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

-- CHECK制約を追加（既にある場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reconciliation_entries_payment_status_check'
  ) THEN
    ALTER TABLE public.reconciliation_entries
      ADD CONSTRAINT reconciliation_entries_payment_status_check
      CHECK (payment_status IN ('pending', 'received', 'partial', 'overdue', 'written_off'));
  END IF;
END $$;

-- =============================================================
-- 完了
-- =============================================================
-- ※ difference は generated column (actual_amount - expected_amount) としてv2で定義済み
-- ※ 「差引残」はフロントエンドで計算: actual_amount + carryover_amount - expected_amount - fee_amount
-- ※ group_label の形式変更: "入金先|支払区分" (例: "VJ協|一括", "JCB|2回")
