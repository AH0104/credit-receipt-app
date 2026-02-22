export interface BrandInfo {
  label: string;
  color: string;
}

export const BRAND_MAP: Record<string, BrandInfo> = {
  'JCB GROUP':    { label: 'JCB',  color: '#0066B3' },
  'MUFGカード':    { label: 'MUFG', color: '#E60012' },
  'ビザ/マスター':  { label: 'V/M',  color: '#1A1F71' },
  'iD':           { label: 'iD',   color: '#D4A017' },
  'QUIC Pay':     { label: 'QP',   color: '#FF6600' },
  '交通IC':        { label: '交通',  color: '#00A651' },
  'Edy':          { label: 'Edy',  color: '#FF4500' },
  'メルペイ':      { label: 'メルペ', color: '#4DC4E0' },
  'auPAY':        { label: 'au',   color: '#FF5722' },
  'dバライ':       { label: 'd払',  color: '#E50012' },
  // 旧値との後方互換
  'JCB':          { label: 'JCB',  color: '#0066B3' },
  'VISA':         { label: 'VISA', color: '#1A1F71' },
  'Mastercard':   { label: 'MC',   color: '#EB001B' },
  'AMEX':         { label: 'AMEX', color: '#006FCF' },
  'Diners':       { label: 'DC',   color: '#006B6F' },
};

export function getBrandInfo(name: string | null): BrandInfo {
  if (!name) return { label: '?', color: '#7A7A7A' };
  // 完全一致
  if (BRAND_MAP[name]) return BRAND_MAP[name];
  // 部分一致（後方互換）
  const upper = name.toUpperCase();
  if (upper.includes('JCB')) return BRAND_MAP['JCB GROUP'];
  if (upper.includes('VISA') || upper.includes('マスター')) return BRAND_MAP['ビザ/マスター'];
  if (upper.includes('MASTER')) return BRAND_MAP['ビザ/マスター'];
  if (upper.includes('MUFG')) return BRAND_MAP['MUFGカード'];
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
