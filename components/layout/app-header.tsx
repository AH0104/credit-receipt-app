'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';

export function AppHeader() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="bg-primary text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">💳</span>
        <div>
          <div className="font-bold text-[15px] leading-tight">クレジット売上管理</div>
          <div className="text-[10px] opacity-70">MINATO Corporation</div>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs transition-colors py-2 px-3"
        title="ログアウト"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">ログアウト</span>
      </button>
    </header>
  );
}
