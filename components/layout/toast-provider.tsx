'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-foreground text-white px-6 py-3 rounded-lg text-sm font-semibold z-[999] shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}
