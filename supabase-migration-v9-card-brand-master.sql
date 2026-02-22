-- v9: カードブランドマスタ
-- OCRで使用するカードブランドの許可リストを管理するテーブル

create table if not exists public.card_brand_master (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  aliases    text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.card_brand_master enable row level security;

-- 全認証ユーザーが閲覧可能
create policy "card_brand_master_select" on public.card_brand_master
  for select to authenticated using (true);

-- editor/admin が編集可能
create policy "card_brand_master_insert" on public.card_brand_master
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

create policy "card_brand_master_update" on public.card_brand_master
  for update to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

create policy "card_brand_master_delete" on public.card_brand_master
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'editor') and is_active = true
    )
  );

-- 初期データ
insert into public.card_brand_master (name, aliases, sort_order) values
  ('JCB GROUP',    array['JCB', 'ジェイシービー', 'ジェーシービー'],                          1),
  ('MUFGカード',    array['MUFG', '三菱UFJ', 'UFJカード', 'MUFGカード'],                      2),
  ('ビザ/マスター',  array['VISA', 'ビザ', 'Mastercard', 'MC', 'マスターカード', 'マスター'],      3),
  ('iD',           array['ID'],                                                             4),
  ('QUIC Pay',     array['QUICPay', 'クイックペイ', 'QUIC Pay'],                              5),
  ('交通IC',        array['交通系IC', '交通系', 'Suica', 'PASMO', 'ICOCA', '交通IC'],           6),
  ('Edy',          array['楽天Edy', 'エディ', 'Edy'],                                        7),
  ('メルペイ',      array['merpay', 'メルペイ'],                                               8),
  ('auPAY',        array['au PAY', 'auペイ', 'aupay', 'auPAY', 'au pay'],                   9),
  ('dバライ',       array['d払い', 'D払い', 'dバライ', 'dbarai', 'd払'],                       10)
on conflict (name) do nothing;
