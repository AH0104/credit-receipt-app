'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useUserProfile } from '@/lib/hooks/use-user-profile';
import type { RolePermissions } from '@/lib/types/user-profile';

interface RoleGuardProps {
  /** 必要な権限キー（例: 'canUpload', 'canManageUsers'） */
  require: keyof RolePermissions;
  children: React.ReactNode;
  /** 権限がない場合の表示（デフォルト: アクセス制限メッセージ） */
  fallback?: React.ReactNode;
}

export function RoleGuard({ require, children, fallback }: RoleGuardProps) {
  const { permissions, loading, profile } = useUserProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!profile?.is_active) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <ShieldAlert className="h-10 w-10 text-accent" />
        <p className="text-sm text-muted">アカウントが無効化されています。管理者にお問い合わせください。</p>
      </div>
    );
  }

  if (!permissions[require]) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <ShieldAlert className="h-10 w-10 text-muted" />
        <p className="text-sm text-muted">この機能を利用する権限がありません。</p>
        <p className="text-xs text-muted">管理者にロールの変更を依頼してください。</p>
      </div>
    );
  }

  return <>{children}</>;
}
