'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, List, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/upload', icon: Camera, label: '読取' },
  { href: '/records', icon: List, label: '一覧' },
  { href: '/summary', icon: BarChart3, label: '集計' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border">
      <div className="max-w-app mx-auto flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary border-t-2 border-primary -mt-[1px]'
                  : 'text-muted hover:text-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
