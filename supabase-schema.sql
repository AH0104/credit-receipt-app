-- =============================================================
-- Supabase SQL Schema for Credit Receipt App
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================

-- 拡張機能の有効化
create extension if not exists "uuid-ossp";

-- =============================================================
-- 1. transactions テーブル
-- =============================================================
create table public.transactions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  transaction_date    date,
  slip_number         text,
  transaction_content text check (
    transaction_content is null or transaction_content in ('売上', '取消', '返品')
  ),
  payment_type        text,
  terminal_number     text,
  card_brand          text,
  amount              integer not null default 0,
  clerk               text,
  confidence          text check (
    confidence in ('high', 'medium', 'low')
  ) default 'medium',
  file_name           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_transactions_user_date
  on public.transactions (user_id, transaction_date desc);

create index idx_transactions_user_brand
  on public.transactions (user_id, card_brand);

-- updated_at 自動更新トリガー
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- =============================================================
-- 2. aggregation_presets テーブル
-- =============================================================
create table public.aggregation_presets (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  group_by          text[] not null default '{"transaction_date"}',
  aggregations      jsonb not null default '[
    {"field": "amount", "function": "sum", "label": "合計金額"},
    {"field": "amount", "function": "count", "label": "件数"}
  ]'::jsonb,
  date_filter_mode  text not null default 'all' check (
    date_filter_mode in ('all', 'month', 'range')
  ),
  sort_column       text default 'transaction_date',
  sort_direction    text default 'desc' check (
    sort_direction in ('asc', 'desc')
  ),
  is_default        boolean not null default false,
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_presets_user on public.aggregation_presets (user_id, display_order);

create trigger set_presets_updated_at
  before update on public.aggregation_presets
  for each row execute function public.handle_updated_at();

-- =============================================================
-- 3. ユーザー登録時にデフォルトプリセット作成
-- =============================================================
create or replace function public.seed_default_presets(p_user_id uuid)
returns void as $$
begin
  insert into public.aggregation_presets (user_id, name, group_by, aggregations, date_filter_mode, is_default, display_order)
  values
    (
      p_user_id,
      '日別集計',
      '{"transaction_date"}',
      '[{"field":"amount","function":"sum","label":"合計金額"},{"field":"amount","function":"count","label":"件数"}]'::jsonb,
      'all',
      true,
      0
    ),
    (
      p_user_id,
      '月別（カード会社別）',
      '{"card_brand"}',
      '[{"field":"amount","function":"sum","label":"合計金額"},{"field":"amount","function":"count","label":"件数"}]'::jsonb,
      'month',
      false,
      1
    ),
    (
      p_user_id,
      '端末・カード会社別',
      '{"terminal_number","card_brand"}',
      '[{"field":"amount","function":"sum","label":"合計金額"},{"field":"amount","function":"count","label":"件数"},{"field":"amount","function":"avg","label":"平均金額"}]'::jsonb,
      'month',
      false,
      2
    );
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  perform public.seed_default_presets(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 4. RLS (Row Level Security)
-- =============================================================
alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions"
  on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions"
  on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own transactions"
  on public.transactions for delete using (auth.uid() = user_id);

alter table public.aggregation_presets enable row level security;

create policy "Users can view own presets"
  on public.aggregation_presets for select using (auth.uid() = user_id);
create policy "Users can insert own presets"
  on public.aggregation_presets for insert with check (auth.uid() = user_id);
create policy "Users can update own presets"
  on public.aggregation_presets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own presets"
  on public.aggregation_presets for delete using (auth.uid() = user_id);

-- =============================================================
-- 5. 集計用 DB ファンクション
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

  -- クエリの組み立て
  v_query := format(
    'select jsonb_agg(row_to_json(sub)) from ('
    || 'select %s from public.transactions where user_id = %L',
    array_to_string(v_select_parts, ', '),
    p_user_id
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
