import type { Transaction } from '@/lib/types/transaction';

export function exportToCsv(transactions: Transaction[]) {
  const header = '取引日,カード会社,取引種別,金額,伝票番号,支払区分,端末番号,係員\n';
  const rows = transactions
    .map(
      (r) =>
        `${r.transaction_date || ''},${r.card_brand || ''},${r.transaction_content || ''},${r.amount || 0},${r.slip_number || ''},${r.payment_type || ''},${r.terminal_number || ''},${r.clerk || ''}`
    )
    .join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `クレジット売上_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
