-- =============================================================
-- Migration v5: ON DELETE CASCADE → RESTRICT に変更（データ保護）
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================
-- ユーザー削除時にビジネスデータが連鎖削除されるのを防止します。
-- 変更後は、関連データがあるユーザーを auth.users から直接削除できなくなります。
-- ユーザー無効化は user_profiles.is_active = false で対応してください。
-- =============================================================

-- 1. transactions テーブル
alter table public.transactions
  drop constraint transactions_user_id_fkey,
  add constraint transactions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 2. upload_logs テーブル
alter table public.upload_logs
  drop constraint upload_logs_user_id_fkey,
  add constraint upload_logs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 3. uploaded_files テーブル
alter table public.uploaded_files
  drop constraint uploaded_files_user_id_fkey,
  add constraint uploaded_files_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 4. ocr_raw_results テーブル
alter table public.ocr_raw_results
  drop constraint ocr_raw_results_user_id_fkey,
  add constraint ocr_raw_results_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 5. card_brand_groups テーブル
alter table public.card_brand_groups
  drop constraint card_brand_groups_user_id_fkey,
  add constraint card_brand_groups_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 6. reconciliation_periods テーブル
alter table public.reconciliation_periods
  drop constraint reconciliation_periods_user_id_fkey,
  add constraint reconciliation_periods_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 7. reconciliation_entries テーブル
alter table public.reconciliation_entries
  drop constraint reconciliation_entries_user_id_fkey,
  add constraint reconciliation_entries_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- 8. aggregation_presets テーブル
alter table public.aggregation_presets
  drop constraint aggregation_presets_user_id_fkey,
  add constraint aggregation_presets_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- ※ user_profiles は CASCADE のまま維持（プロフィール自体はユーザーと一体）
-- ※ ユーザーを本当に削除したい場合は、先に各テーブルのデータを
--   手動で削除してから auth.users を削除してください。
