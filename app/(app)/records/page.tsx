'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { getBrandInfo, formatYen, isCancel, getConfidenceBadge } from '@/lib/constants/card-brands';
import { exportToCsv } from '@/lib/utils/csv-export';
import type { Transaction } from '@/lib/types/transaction';

export default function RecordsPage() {
  const { transactions, loading, update, remove } = useTransactions();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
      {/* 統計バー */}
      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted">総件数</div>
            <div className="text-lg font-bold text-foreground">{transactions.length} 件</div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted">合計金額</div>
            <div className="text-lg font-bold text-primary">{formatYen(totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button
          variant="dashed"
          className="flex-1"
          onClick={() => router.push('/upload')}
        >
          <Plus className="h-4 w-4 mr-1" />
          追加読取
        </Button>
        {transactions.length > 0 && (
          <Button
            variant="outline"
            onClick={() => exportToCsv(transactions)}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        )}
      </div>

      {/* レコード一覧 */}
      {transactions.length === 0 ? (
        <Card className="py-10">
          <CardContent className="text-center">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-sm text-muted">データがありません。「読取」タブから写真をアップロードしてください。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => {
            const brand = getBrandInfo(t.card_brand);
            const conf = getConfidenceBadge(t.confidence);
            const cancel = isCancel(t.transaction_content);
            const isEditing = editingId === t.id;

            return (
              <Card
                key={t.id}
                className={isEditing ? 'ring-2 ring-primary bg-primary-light/20' : ''}
              >
                <CardContent className="p-3">
                  {isEditing ? (
                    /* 編集モード */
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>取引日</Label>
                          <Input
                            type="date"
                            value={editFields.transaction_date || ''}
                            onChange={(e) => setEditFields({ ...editFields, transaction_date: e.target.value })}
                            className="h-9 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label>カード会社</Label>
                          <select
                            value={editFields.card_brand || ''}
                            onChange={(e) => setEditFields({ ...editFields, card_brand: e.target.value })}
                            className="flex h-9 w-full rounded-lg border border-border bg-card px-2 text-sm mt-1"
                          >
                            <option value="">選択</option>
                            <option value="JCB">JCB</option>
                            <option value="VISA">VISA</option>
                            <option value="Mastercard">Mastercard</option>
                            <option value="AMEX">AMEX</option>
                            <option value="Diners">Diners</option>
                            <option value="その他">その他</option>
                          </select>
                        </div>
                        <div>
                          <Label>区分</Label>
                          <select
                            value={editFields.transaction_content || ''}
                            onChange={(e) => setEditFields({ ...editFields, transaction_content: e.target.value })}
                            className="flex h-9 w-full rounded-lg border border-border bg-card px-2 text-sm mt-1"
                          >
                            <option value="売上">売上</option>
                            <option value="取消">取消</option>
                            <option value="返品">返品</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>金額</Label>
                          <Input
                            type="number"
                            value={editFields.amount || ''}
                            onChange={(e) => setEditFields({ ...editFields, amount: Number(e.target.value) || 0 })}
                            className="h-9 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label>伝票番号</Label>
                          <Input
                            value={editFields.slip_number || ''}
                            onChange={(e) => setEditFields({ ...editFields, slip_number: e.target.value })}
                            className="h-9 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label>係員</Label>
                          <Input
                            value={editFields.clerk || ''}
                            onChange={(e) => setEditFields({ ...editFields, clerk: e.target.value })}
                            className="h-9 text-sm mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setDeleteTarget(t); setEditingId(null); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          削除
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" />
                          キャンセル
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* 表示モード */
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => startEdit(t)}>
                      <div
                        className="w-11 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: brand.color }}
                      >
                        {brand.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[15px] font-bold ${cancel ? 'text-accent' : 'text-foreground'}`}>
                            {cancel ? '−' : ''}{formatYen(t.amount)}
                          </span>
                          {cancel && t.transaction_content && (
                            <Badge variant="destructive" className="text-[10px]">{t.transaction_content}</Badge>
                          )}
                          <Badge variant={conf.variant} className="text-[10px] ml-auto">{conf.label}</Badge>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {t.transaction_date || '日付不明'} ・ 伝票 {t.slip_number || '---'}
                        </div>
                      </div>
                      <Pencil className="h-4 w-4 text-border shrink-0" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
