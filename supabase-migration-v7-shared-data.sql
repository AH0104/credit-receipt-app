-- =============================================================
-- Migration v7: データ共有化 — 全ユーザーが全データを閲覧可能に
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================
-- 同じ組織の全ユーザーが取引データ・アップロード履歴・照合データを
-- 共有して閲覧できるようにRLSポリシーを変更します。
-- INSERTは引き続き各ユーザーが自分のレコードとして作成。
-- UPDATE/DELETEはロール（admin/editor）に基づいて制御。
-- =============================================================

-- =============================================================
-- 1. transactions テーブル
-- =============================================================
-- SELECT: 認証済みユーザー全員
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Authenticated users can view all transactions"
  on public.transactions for select
  using (auth.uid() is not null);

-- INSERT: 自分のレコードとして
-- (既存の "Users can insert own transactions" をそのまま利用)

-- UPDATE: editor/admin は全レコード更新可（viewer は不可）
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Editors and admins can update any transaction"
  on public.transactions for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- DELETE: editor/admin は全レコード削除可
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Editors and admins can delete any transaction"
  on public.transactions for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 2. upload_logs テーブル
-- =============================================================
drop policy if exists "Users can view own upload_logs" on public.upload_logs;
create policy "Authenticated users can view all upload_logs"
  on public.upload_logs for select
  using (auth.uid() is not null);

-- UPDATE: editor/admin が更新可能（saved_records 等の更新用）
create policy "Editors and admins can update any upload_log"
  on public.upload_logs for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 3. uploaded_files テーブル
-- =============================================================
drop policy if exists "Users can view own uploaded_files" on public.uploaded_files;
create policy "Authenticated users can view all uploaded_files"
  on public.uploaded_files for select
  using (auth.uid() is not null);

-- =============================================================
-- 4. ocr_raw_results テーブル
-- =============================================================
drop policy if exists "Users can view own ocr_raw_results" on public.ocr_raw_results;
create policy "Authenticated users can view all ocr_raw_results"
  on public.ocr_raw_results for select
  using (auth.uid() is not null);

drop policy if exists "Users can update own ocr_raw_results" on public.ocr_raw_results;
create policy "Editors and admins can update any ocr_raw_result"
  on public.ocr_raw_results for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 5. card_brand_groups テーブル
-- =============================================================
drop policy if exists "Users can view own card_brand_groups" on public.card_brand_groups;
create policy "Authenticated users can view all card_brand_groups"
  on public.card_brand_groups for select
  using (auth.uid() is not null);

drop policy if exists "Users can update own card_brand_groups" on public.card_brand_groups;
create policy "Editors and admins can update any card_brand_group"
  on public.card_brand_groups for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

drop policy if exists "Users can delete own card_brand_groups" on public.card_brand_groups;
create policy "Editors and admins can delete any card_brand_group"
  on public.card_brand_groups for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 6. reconciliation_periods テーブル
-- =============================================================
drop policy if exists "Users can view own reconciliation_periods" on public.reconciliation_periods;
create policy "Authenticated users can view all reconciliation_periods"
  on public.reconciliation_periods for select
  using (auth.uid() is not null);

drop policy if exists "Users can update own reconciliation_periods" on public.reconciliation_periods;
create policy "Editors and admins can update any reconciliation_period"
  on public.reconciliation_periods for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

drop policy if exists "Users can delete own reconciliation_periods" on public.reconciliation_periods;
create policy "Editors and admins can delete any reconciliation_period"
  on public.reconciliation_periods for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 7. reconciliation_entries テーブル
-- =============================================================
drop policy if exists "Users can view own reconciliation_entries" on public.reconciliation_entries;
create policy "Authenticated users can view all reconciliation_entries"
  on public.reconciliation_entries for select
  using (auth.uid() is not null);

drop policy if exists "Users can update own reconciliation_entries" on public.reconciliation_entries;
create policy "Editors and admins can update any reconciliation_entry"
  on public.reconciliation_entries for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

drop policy if exists "Users can delete own reconciliation_entries" on public.reconciliation_entries;
create policy "Editors and admins can delete any reconciliation_entry"
  on public.reconciliation_entries for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- =============================================================
-- 8. Storage: レシート画像を全認証ユーザーに閲覧許可
-- =============================================================
drop policy if exists "Users can view own receipts" on storage.objects;
create policy "Authenticated users can view all receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid() is not null);

-- =============================================================
-- 9. aggregate_transactions 関数を更新（全ユーザーのデータを集計）
-- =============================================================
create or replace function public.aggregate_transactions(
  p_user_id uuid,
  p_group_by text[],
  p_aggregations jsonb,
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb as $$
declare
  v_select_parts text[] := '{}';
  v_group_parts text[] := '{}';
  v_query text;
  v_result jsonb;
  v_agg record;
  v_col text;
  v_allowed_columns text[] := array[
    'transaction_date', 'card_brand', 'payment_type',
    'terminal_number', 'transaction_content', 'clerk'
  ];
  v_allowed_functions text[] := array['sum', 'count', 'avg', 'max', 'min'];
begin
  -- GROUP BY カラムの構築（ホワイトリスト検証）
  foreach v_col in array p_group_by loop
    if v_col = any(v_allowed_columns) then
      if v_col = 'transaction_date' then
        v_select_parts := array_append(v_select_parts,
          'transaction_date::text as transaction_date');
      else
        v_select_parts := array_append(v_select_parts,
          format('%I::text as %I', v_col, v_col));
      end if;
      v_group_parts := array_append(v_group_parts, format('%I', v_col));
    end if;
  end loop;

  -- 集計関数の構築（ホワイトリスト検証）
  for v_agg in select * from jsonb_to_recordset(p_aggregations)
    as x("field" text, "function" text, "label" text)
  loop
    if v_agg."function" = any(v_allowed_functions) then
      if v_agg."function" = 'count' then
        v_select_parts := array_append(v_select_parts,
          format('count(*)::integer as %I', coalesce(v_agg."label", 'count')));
      else
        v_select_parts := array_append(v_select_parts,
          format('%s(%I)::numeric as %I',
            v_agg."function", v_agg."field",
            coalesce(v_agg."label", v_agg."function" || '_' || v_agg."field")));
      end if;
    end if;
  end loop;

  -- クエリの組み立て（user_id フィルタなし＝全ユーザー共通データ）
  v_query := format(
    'select jsonb_agg(row_to_json(sub)) from ('
    || 'select %s from public.transactions where 1=1',
    array_to_string(v_select_parts, ', ')
  );

  if p_date_from is not null then
    v_query := v_query || format(' and transaction_date >= %L', p_date_from);
  end if;

  if p_date_to is not null then
    v_query := v_query || format(' and transaction_date <= %L', p_date_to);
  end if;

  if array_length(v_group_parts, 1) > 0 then
    v_query := v_query || ' group by ' || array_to_string(v_group_parts, ', ');
    v_query := v_query || ' order by ' || v_group_parts[1];
  end if;

  v_query := v_query || ') sub';

  execute v_query into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$ language plpgsql security definer;

-- ※ aggregation_presets は個人設定のためユーザー別のまま維持
-- ※ INSERT ポリシーは引き続き user_id = auth.uid() チェック（各自の名義で登録）
-- ※ user_profiles は v3/v4 のポリシーをそのまま維持
