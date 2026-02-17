'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
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

    const email = `${userId}@internal.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('ユーザーIDまたはパスワードが間違っています');
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
            <Label htmlFor="userId">ユーザーID</Label>
            <Input
              id="userId"
              type="text"
              inputMode="numeric"
              placeholder="例: 001"
              value={userId}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                setUserId(v);
              }}
              required
              maxLength={3}
              autoComplete="username"
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

          <p className="text-center text-xs text-muted">
            管理者からアカウントキーを受け取ってください
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
