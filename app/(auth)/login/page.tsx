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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'メールアドレスまたはパスワードが間違っています'
          : 'ログインに失敗しました。もう一度お試しください。'
      );
      setLoading(false);
      return;
    }

    router.push('/upload');
    router.refresh();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="text-4xl mb-2">💳</div>
        <CardTitle className="text-xl">クレジット売上管理</CardTitle>
        <p className="text-sm text-muted mt-1">MINATO Corporation</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          {error && (
            <div className="bg-accent-light text-accent text-sm p-3 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <Button type="submit" size="full" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>

          <p className="text-center text-sm text-muted">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-primary font-semibold hover:underline">
              新規登録
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
