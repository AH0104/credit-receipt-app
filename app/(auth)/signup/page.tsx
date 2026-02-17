'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setError('登録に失敗しました。もう一度お試しください。');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">✉️</div>
          <CardTitle className="text-lg">確認メールを送信しました</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">{email}</span>
            <br />
            に確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。
          </p>
          <Button variant="outline" size="full" onClick={() => router.push('/login')}>
            ログイン画面に戻る
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="text-4xl mb-2">💳</div>
        <CardTitle className="text-xl">新規アカウント登録</CardTitle>
        <p className="text-sm text-muted mt-1">クレジット売上管理システム</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@company.co.jp"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">パスワード確認</Label>
            <Input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              placeholder="もう一度入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="bg-accent-light text-accent text-sm p-3 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <Button type="submit" size="full" disabled={loading}>
            {loading ? '登録中...' : 'アカウントを作成'}
          </Button>

          <p className="text-center text-sm text-muted">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              ログイン
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
