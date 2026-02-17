'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, List, BarChart3, Scale, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/upload', icon: Camera, label: '読取' },
  { href: '/records', icon: List, label: '一覧' },
  { href: '/summary', icon: BarChart3, label: '集計' },
  { href: '/reconcile', icon: Scale, label: '照合' },
  { href: '/settings', icon: Settings, label: '設定' },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="bg-primary text-white">
      <div className="max-w-app mx-auto flex items-center justify-between px-4 h-14">
        {/* ロゴ */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">💳</span>
          <span className="font-bold text-[15px]">クレジット売上管理</span>
        </div>

        {/* ナビゲーション */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ログアウト */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors py-2 px-3 rounded-lg hover:bg-white/10 shrink-0"
          title="ログアウト"
        >
          <LogOut className="h-4 w-4" />
          <span>ログアウト</span>
        </button>
      </div>
    </header>
  );
}
