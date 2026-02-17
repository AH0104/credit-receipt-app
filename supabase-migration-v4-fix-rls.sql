-- =============================================================
-- Migration v4: RLSポリシーの無限再帰を修正
-- Supabase ダッシュボードの SQL Editor で実行してください
-- =============================================================

-- 1. admin判定用のヘルパー関数を作成（security definer でRLSをバイパス）
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- 2. 既存の再帰ポリシーを削除
drop policy if exists "Admins can view all profiles" on public.user_profiles;
drop policy if exists "Admins can update any profile" on public.user_profiles;
drop policy if exists "Users can update own profile display_name" on public.user_profiles;

-- 3. 新しいポリシーを作成（ヘルパー関数を使用して再帰を回避）
create policy "Users can view own profile or admins view all"
  on public.user_profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.user_profiles for update
  using (public.is_admin());
