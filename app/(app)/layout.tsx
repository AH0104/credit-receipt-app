import { AppHeader } from '@/components/layout/app-header';
import { ToastProvider } from '@/components/layout/toast-provider';

export const dynamic = 'force-dynamic';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-background font-sans">
        <AppHeader />
        <main className="max-w-app mx-auto px-6 py-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
