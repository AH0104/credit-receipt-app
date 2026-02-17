'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Trash2, Check, X, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { useUserProfile } from '@/lib/hooks/use-user-profile';
import { getBrandInfo, formatYen, isCancel } from '@/lib/constants/card-brands';
import { exportToCsv } from '@/lib/utils/csv-export';
import type { Transaction } from '@/lib/types/transaction';

type FilterMode = 'all' | 'active' | 'archived';

export default function RecordsPage() {
  const {
    transactions, loading, update, remove,
    page, setPage, totalCount, totalPages, pageSize,
    yearMonth, changeYearMonth, yearMonthOptions,
  } = useTransactions();
  const { permissions } = useUserProfile();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const router = useRouter();

  const filtered = useMemo(() => {
    if (filter === 'active') return transactions.filter((t) => !t.archived_period_id);
    if (filter === 'archived') return transactions.filter((t) => !!t.archived_period_id);
    return transactions;
  }, [transactions, filter]);

  const archivedCount = useMemo(() => transactions.filter((t) => !!t.archived_period_id).length, [transactions]);

  const totalAmount = filtered.reduce((sum, r) => {
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

  // ページネーション表示用の範囲
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

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
            {totalCount}件 ・ 合計 <span className="font-semibold text-primary">{formatYen(totalAmount)}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/upload')}>
            <Plus className="h-4 w-4 mr-1" />
            追加読取
          </Button>
          {transactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered)}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* 年月フィルタ */}
      {yearMonthOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted">期間</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => changeYearMonth(null)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                yearMonth === null
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-border text-muted hover:bg-primary-light/20'
              }`}
            >
              すべて
            </button>
            {yearMonthOptions.map((opt) => {
              const key = `${opt.year}-${String(opt.month).padStart(2, '0')}`;
              return (
                <button
                  key={key}
                  onClick={() => changeYearMonth(key)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    yearMonth === key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card border-border text-muted hover:bg-primary-light/20'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 確定/未確定フィルタ */}
      {archivedCount > 0 && (
        <div className="flex gap-1">
          {([
            { key: 'all', label: `すべて (${transactions.length})` },
            { key: 'active', label: `未確定 (${transactions.length - archivedCount})` },
            { key: 'archived', label: `確定済 (${archivedCount})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                filter === key
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-border text-muted hover:bg-primary-light/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* テーブル */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">
          {yearMonth
            ? 'この期間のデータはありません。'
            : 'データがありません。「読取」タブから写真をアップロードしてください。'}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-card">
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">取引日</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">カード</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">区分</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted text-xs">金額</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">伝票No</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">支払方法</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">端末</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">係員</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">アップロード日</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted text-xs w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
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
                      <td className="px-2 py-1.5 text-xs text-muted whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
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
                    onClick={() => !isArchived && permissions.canEditRecords && startEdit(t)}
                    className={`border-b border-border last:border-b-0 transition-colors ${
                      isArchived || !permissions.canEditRecords ? 'opacity-50' : 'hover:bg-primary-light/20 cursor-pointer'
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
                    <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 text-center text-border">
                      <span className="text-xs">{isArchived ? '確定済' : permissions.canEditRecords ? 'クリックで編集' : '閲覧のみ'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted">
            {rangeStart}〜{rangeEnd} / {totalCount}件
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1.5 rounded border border-border bg-card text-muted hover:bg-primary-light/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="最初のページ"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded border border-border bg-card text-muted hover:bg-primary-light/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="前のページ"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-border bg-card text-muted hover:bg-primary-light/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="次のページ"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-border bg-card text-muted hover:bg-primary-light/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="最後のページ"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
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
