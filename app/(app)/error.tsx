'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <h2 className="text-lg font-bold text-accent">エラーが発生しました</h2>
      <pre className="bg-background border border-border rounded-lg p-4 text-xs text-foreground max-w-lg overflow-auto whitespace-pre-wrap">
        {error.message}
        {error.stack && (
          <>
            {'\n\n'}
            {error.stack}
          </>
        )}
      </pre>
      <Button onClick={reset} variant="outline" size="sm">
        再試行
      </Button>
    </div>
  );
}
