-- =============================================================
-- Migration: アップロード履歴・カードグループ・入金照合・アーカイブ
-- Supabase ダッシュボードの SQL Editor で実行してください
-- ※ supabase-schema.sql を既に実行済みの前提です
-- =============================================================

-- =============================================================
-- 1. upload_logs（アップロードセッション記録）
-- =============================================================
create table public.upload_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  file_count    integer not null default 0,
  total_records integer not null default 0,
  saved_records integer not null default 0,
  uploaded_at   timestamptz not null default now()
);

create index idx_upload_logs_user on public.upload_logs (user_id, uploaded_at desc);

alter table public.upload_logs enable row level security;
create policy "Users can view own upload_logs"
  on public.upload_logs for select using (auth.uid() = user_id);
create policy "Users can insert own upload_logs"
  on public.upload_logs for insert with check (auth.uid() = user_id);

-- =============================================================
-- 2. uploaded_files（アップロードファイル単位の記録）
-- =============================================================
create table public.uploaded_files (
  id            uuid primary key default uuid_generate_v4(),
  upload_log_id uuid not null references public.upload_logs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  file_size     integer,
  mime_type     text,
  uploaded_at   timestamptz not null default now()
);

create index idx_uploaded_files_log on public.uploaded_files (upload_log_id);

alter table public.uploaded_files enable row level security;
create policy "Users can view own uploaded_files"
  on public.uploaded_files for select using (auth.uid() = user_id);
create policy "Users can insert own uploaded_files"
  on public.uploaded_files for insert with check (auth.uid() = user_id);

-- =============================================================
-- 3. ocr_raw_results（OCR生データ保存）
-- =============================================================
create table public.ocr_raw_results (
  id               uuid primary key default uuid_generate_v4(),
  uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  transaction_id   uuid references public.transactions(id) on delete set null,
  raw_data         jsonb not null,
  created_at       timestamptz not null default now()
);

create index idx_ocr_raw_file on public.ocr_raw_results (uploaded_file_id);
create index idx_ocr_raw_transaction on public.ocr_raw_results (transaction_id);

alter table public.ocr_raw_results enable row level security;
create policy "Users can view own ocr_raw_results"
  on public.ocr_raw_results for select using (auth.uid() = user_id);
create policy "Users can insert own ocr_raw_results"
  on public.ocr_raw_results for insert with check (auth.uid() = user_id);
create policy "Users can update own ocr_raw_results"
  on public.ocr_raw_results for update using (auth.uid() = user_id);

-- =============================================================
-- 4. card_brand_groups（カード会社グループ定義）
-- =============================================================
create table public.card_brand_groups (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_name  text not null,
  brands      text[] not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_card_brand_groups_user on public.card_brand_groups (user_id, sort_order);

create trigger set_card_brand_groups_updated_at
  before update on public.card_brand_groups
  for each row execute function public.handle_updated_at();

alter table public.card_brand_groups enable row level security;
create policy "Users can view own card_brand_groups"
  on public.card_brand_groups for select using (auth.uid() = user_id);
create policy "Users can insert own card_brand_groups"
  on public.card_brand_groups for insert with check (auth.uid() = user_id);
create policy "Users can update own card_brand_groups"
  on public.card_brand_groups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own card_brand_groups"
  on public.card_brand_groups for delete using (auth.uid() = user_id);

-- =============================================================
-- 5. reconciliation_periods（入金照合期間）
-- =============================================================
create table public.reconciliation_periods (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_label  text not null,
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'open' check (
    status in ('open', 'reconciling', 'archived')
  ),
  confirmed_at  timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_reconciliation_periods_user on public.reconciliation_periods (user_id, period_start desc);

create trigger set_reconciliation_periods_updated_at
  before update on public.reconciliation_periods
  for each row execute function public.handle_updated_at();

alter table public.reconciliation_periods enable row level security;
create policy "Users can view own reconciliation_periods"
  on public.reconciliation_periods for select using (auth.uid() = user_id);
create policy "Users can insert own reconciliation_periods"
  on public.reconciliation_periods for insert with check (auth.uid() = user_id);
create policy "Users can update own reconciliation_periods"
  on public.reconciliation_periods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reconciliation_periods"
  on public.reconciliation_periods for delete using (auth.uid() = user_id);

-- =============================================================
-- 6. reconciliation_entries（照合明細：グループ別の入金額比較）
-- =============================================================
create table public.reconciliation_entries (
  id              uuid primary key default uuid_generate_v4(),
  period_id       uuid not null references public.reconciliation_periods(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  group_label     text not null,
  expected_amount integer not null default 0,
  actual_amount   integer not null default 0,
  difference      integer generated always as (actual_amount - expected_amount) stored,
  status          text not null default 'pending' check (
    status in ('pending', 'matched', 'mismatched', 'resolved')
  ),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_reconciliation_entries_period on public.reconciliation_entries (period_id);

create trigger set_reconciliation_entries_updated_at
  before update on public.reconciliation_entries
  for each row execute function public.handle_updated_at();

alter table public.reconciliation_entries enable row level security;
create policy "Users can view own reconciliation_entries"
  on public.reconciliation_entries for select using (auth.uid() = user_id);
create policy "Users can insert own reconciliation_entries"
  on public.reconciliation_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own reconciliation_entries"
  on public.reconciliation_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reconciliation_entries"
  on public.reconciliation_entries for delete using (auth.uid() = user_id);

-- =============================================================
-- 7. transactions テーブルにカラム追加
-- =============================================================
alter table public.transactions
  add column if not exists upload_log_id uuid references public.upload_logs(id) on delete set null;

alter table public.transactions
  add column if not exists archived_period_id uuid references public.reconciliation_periods(id) on delete set null;

create index idx_transactions_upload_log on public.transactions (upload_log_id);
create index idx_transactions_archived on public.transactions (archived_period_id);

-- =============================================================
-- 8. Supabase Storage バケット作成
-- ※ SQL Editor では作れないため、ダッシュボードの Storage で
--   「receipts」バケットを作成し、RLS を有効化してください。
--   以下のポリシーを Storage > Policies で追加：
-- =============================================================
-- バケット作成（Supabase v2 では storage.buckets に直接 INSERT 可能）
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage RLS ポリシー
create policy "Users can upload own receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
