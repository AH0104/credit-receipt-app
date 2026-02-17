import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = await request.json();
  const { loginId, password, displayName, role } = body;

  // バリデーション: ID は数字3桁
  if (!/^[0-9]{3}$/.test(loginId)) {
    return NextResponse.json({ error: 'ユーザーIDは数字3桁で入力してください' }, { status: 400 });
  }

  // バリデーション: パスワードはアルファベット1文字 + 数字5桁
  if (!/^[a-zA-Z][0-9]{5}$/.test(password)) {
    return NextResponse.json({ error: 'パスワードはアルファベット1文字＋数字5桁で入力してください' }, { status: 400 });
  }

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 });
  }

  const email = `${loginId}@internal`;
  const adminSupabase = createAdminClient();

  // ユーザー作成（メール確認不要）
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message?.includes('already been registered')) {
      return NextResponse.json({ error: `ID ${loginId} は既に登録されています` }, { status: 409 });
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // user_profiles を更新（トリガーが自動作成したレコードの display_name と role を設定）
  if (newUser.user) {
    await adminSupabase
      .from('user_profiles')
      .update({ display_name: displayName || null, role })
      .eq('id', newUser.user.id);
  }

  return NextResponse.json({ success: true, userId: newUser.user?.id });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('id');
  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  // 自分自身は削除不可
  if (userId === admin.id) {
    return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // user_profiles を先に削除
  await adminSupabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  // auth.users を削除
  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
