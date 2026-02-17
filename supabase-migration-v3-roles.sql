-- =============================================================
-- Migration v3: ユーザー管理と権限ロール
-- Supabase ダッシュボードの SQL Editor で実行してください
-- ※ supabase-schema.sql, supabase-migration-v2.sql 実行済みの前提
-- =============================================================

-- =============================================================
-- 0. handle_updated_at 関数（存在しない場合のみ作成）
-- =============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================
-- 1. user_profiles（ユーザープロフィール・ロール管理）
-- =============================================================
create table public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  display_name text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_profiles_role on public.user_profiles (role);

-- updated_at トリガー（supabase-schema.sql で定義済みの handle_updated_at を使用）
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

-- RLS 有効化
alter table public.user_profiles enable row level security;

-- admin は全ユーザーを閲覧可能、それ以外は自分のみ
create policy "Admins can view all profiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or id = auth.uid()
  );

-- 自分のプロフィールは更新可能（ただしroleとis_activeの変更は別途制限）
create policy "Users can update own profile display_name"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- admin のみ他ユーザーのプロフィールを更新可能
create policy "Admins can update any profile"
  on public.user_profiles for update
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- insert は新規ユーザー登録時のみ（トリガーで自動）
create policy "Allow insert own profile"
  on public.user_profiles for insert
  with check (id = auth.uid());

-- =============================================================
-- 2. 新規ユーザー登録時に自動でプロフィールを作成するトリガー
--    最初のユーザーは admin、以降は viewer
-- =============================================================
create or replace function public.handle_new_user_profile()
returns trigger as $$
declare
  user_count integer;
  user_role text;
begin
  select count(*) into user_count from public.user_profiles;
  if user_count = 0 then
    user_role := 'admin';
  else
    user_role := 'viewer';
  end if;

  insert into public.user_profiles (id, email, role, display_name)
  values (new.id, new.email, user_role, split_part(new.email, '@', 1));

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- =============================================================
-- 3. ロール取得用の関数（ミドルウェアやクライアントから使用）
-- =============================================================
create or replace function public.get_user_role()
returns text as $$
declare
  user_role text;
begin
  select role into user_role
  from public.user_profiles
  where id = auth.uid() and is_active = true;

  return coalesce(user_role, 'viewer');
end;
$$ language plpgsql security definer stable;

-- =============================================================
-- 4. 既存ユーザーへの対応（既にユーザーが存在する場合）
--    ※ 既存ユーザーのプロフィールが未作成の場合に実行
-- =============================================================
-- 既存の auth.users からプロフィールを作成（最初の1人をadminに）
insert into public.user_profiles (id, email, role, display_name)
select
  u.id,
  u.email,
  case
    when row_number() over (order by u.created_at asc) = 1 then 'admin'
    else 'viewer'
  end as role,
  split_part(u.email, '@', 1) as display_name
from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.id = u.id
);
