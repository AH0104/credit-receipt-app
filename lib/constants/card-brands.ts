export interface BrandInfo {
  label: string;
  color: string;
}

export const BRAND_MAP: Record<string, BrandInfo> = {
  JCB: { label: 'JCB', color: '#0066B3' },
  VISA: { label: 'VISA', color: '#1A1F71' },
  Mastercard: { label: 'MC', color: '#EB001B' },
  AMEX: { label: 'AMEX', color: '#006FCF' },
  Diners: { label: 'DC', color: '#006B6F' },
};

export function getBrandInfo(name: string | null): BrandInfo {
  if (!name) return { label: '?', color: '#7A7A7A' };
  const upper = name.toUpperCase();
  if (upper.includes('JCB')) return BRAND_MAP.JCB;
  if (upper.includes('VISA')) return BRAND_MAP.VISA;
  if (upper.includes('MASTER')) return BRAND_MAP.Mastercard;
  if (upper.includes('AMEX')) return BRAND_MAP.AMEX;
  if (upper.includes('DINER')) return BRAND_MAP.Diners;
  return { label: name.slice(0, 4), color: '#7A7A7A' };
}

export function getConfidenceBadge(level: string) {
  if (level === 'high') return { label: 'OK', variant: 'success' as const };
  if (level === 'medium') return { label: '要確認', variant: 'warning' as const };
  return { label: '読取不可', variant: 'destructive' as const };
}

export function formatYen(n: number | null): string {
  return `¥${(n || 0).toLocaleString()}`;
}

export function isCancel(transactionContent: string | null): boolean {
  return transactionContent === '取消' || transactionContent === '返品';
}
