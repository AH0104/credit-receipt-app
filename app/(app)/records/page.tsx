'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { getBrandInfo, formatYen, isCancel } from '@/lib/constants/card-brands';
import { exportToCsv } from '@/lib/utils/csv-export';
import type { Transaction } from '@/lib/types/transaction';

export default function RecordsPage() {
  const { transactions, loading, update, remove } = useTransactions();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const totalAmount = transactions.reduce((sum, r) => {
    const sign = isCancel(r.transaction_content) ? -1 : 1;
    return sum + (r.amount || 0) * sign;
  }, 0);

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditFields({
      transaction_date: t.transaction_date,
      card_brand: t.card_brand,
      transaction_content: t.transaction_content,
      amount: t.amount,
      slip_number: t.slip_number,
      payment_type: t.payment_type,
      terminal_number: t.terminal_number,
      clerk: t.clerk,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await update(editingId, editFields);
      setEditingId(null);
      showToast('更新しました');
    } catch {
      showToast('更新に失敗しました');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      showToast('削除しました');
    } catch {
      showToast('削除に失敗しました');
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-foreground">取引一覧</h1>
          <span className="text-sm text-muted">
            {transactions.length}件 ・ 合計 <span className="font-semibold text-primary">{formatYen(totalAmount)}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/upload')}>
            <Plus className="h-4 w-4 mr-1" />
            追加読取
          </Button>
          {transactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportToCsv(transactions)}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* テーブル */}
      {transactions.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">
          データがありません。「読取」タブから写真をアップロードしてください。
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">日付</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">カード</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">区分</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted text-xs">金額</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">伝票No</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">支払方法</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">端末</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">係員</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted text-xs w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const brand = getBrandInfo(t.card_brand);
                const cancel = isCancel(t.transaction_content);
                const isArchived = !!t.archived_period_id;
                const isEditing = editingId === t.id;

                if (isEditing) {
                  return (
                    <tr key={t.id} className="border-b border-border bg-primary-light/30">
                      <td className="px-2 py-1.5">
                        <Input
                          type="date"
                          value={editFields.transaction_date || ''}
                          onChange={(e) => setEditFields({ ...editFields, transaction_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={editFields.card_brand || ''}
                          onChange={(e) => setEditFields({ ...editFields, card_brand: e.target.value })}
                          className="h-8 w-full rounded border border-border bg-card px-1.5 text-xs"
                        >
                          <option value="">--</option>
                          <option value="JCB">JCB</option>
                          <option value="VISA">VISA</option>
                          <option value="Mastercard">MC</option>
                          <option value="AMEX">AMEX</option>
                          <option value="Diners">Diners</option>
                          <option value="その他">その他</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={editFields.transaction_content || ''}
                          onChange={(e) => setEditFields({ ...editFields, transaction_content: e.target.value })}
                          className="h-8 w-full rounded border border-border bg-card px-1.5 text-xs"
                        >
                          <option value="売上">売上</option>
                          <option value="取消">取消</option>
                          <option value="返品">返品</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          value={editFields.amount || ''}
                          onChange={(e) => setEditFields({ ...editFields, amount: Number(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={editFields.slip_number || ''}
                          onChange={(e) => setEditFields({ ...editFields, slip_number: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={editFields.payment_type || ''}
                          onChange={(e) => setEditFields({ ...editFields, payment_type: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={editFields.terminal_number || ''}
                          onChange={(e) => setEditFields({ ...editFields, terminal_number: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={editFields.clerk || ''}
                          onChange={(e) => setEditFields({ ...editFields, clerk: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={saveEdit}
                            className="p-1.5 rounded hover:bg-success-light text-success transition-colors"
                            title="保存"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded hover:bg-background text-muted transition-colors"
                            title="キャンセル"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(t); setEditingId(null); }}
                            className="p-1.5 rounded hover:bg-accent-light text-accent transition-colors"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={t.id}
                    onClick={() => !isArchived && startEdit(t)}
                    className={`border-b border-border last:border-b-0 transition-colors ${
                      isArchived ? 'opacity-50' : 'hover:bg-primary-light/20 cursor-pointer'
                    }`}
                  >
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">
                      {t.transaction_date || '---'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded text-white text-[10px] font-bold"
                        style={{ backgroundColor: brand.color }}
                      >
                        {brand.label}
                      </span>
                    </td>
                    <td className={`px-3 py-2 ${cancel ? 'text-accent font-semibold' : 'text-foreground'}`}>
                      {t.transaction_content || '売上'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${cancel ? 'text-accent' : 'text-foreground'} font-semibold`}>
                      {cancel ? '−' : ''}{formatYen(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-muted">{t.slip_number || '---'}</td>
                    <td className="px-3 py-2 text-muted">{t.payment_type || '---'}</td>
                    <td className="px-3 py-2 text-muted">{t.terminal_number || '---'}</td>
                    <td className="px-3 py-2 text-muted">{t.clerk || '---'}</td>
                    <td className="px-3 py-2 text-center text-border">
                      <span className="text-xs">{isArchived ? '確定済' : 'クリックで編集'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>本当に削除しますか？</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  {deleteTarget.transaction_date} ・ {formatYen(deleteTarget.amount)}
                  <br />
                  この操作は取り消せません。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
