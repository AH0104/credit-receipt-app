'use client';

import { useState, useEffect } from 'react';
import { Plus, Archive, Loader2, Check, AlertTriangle, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useReconciliation, type PeriodWithEntries } from '@/lib/hooks/use-reconciliation';
import { useCardGroups } from '@/lib/hooks/use-card-groups';
import { formatYen } from '@/lib/constants/card-brands';

function getStatusBadge(status: string) {
  switch (status) {
    case 'open': return { label: '未着手', variant: 'secondary' as const };
    case 'reconciling': return { label: '照合中', variant: 'warning' as const };
    case 'archived': return { label: '確定済', variant: 'success' as const };
    default: return { label: status, variant: 'secondary' as const };
  }
}

function getEntryStatusIcon(status: string) {
  switch (status) {
    case 'matched': return <Check className="h-4 w-4 text-success" />;
    case 'mismatched': return <AlertTriangle className="h-4 w-4 text-accent" />;
    case 'resolved': return <Check className="h-4 w-4 text-primary" />;
    default: return <Minus className="h-4 w-4 text-muted" />;
  }
}

export default function ReconcilePage() {
  const { periods, loading, createPeriod, updatePeriod, deletePeriod, upsertEntry, archivePeriod, computeActuals } = useReconciliation();
  const { groups, getBrandGroup } = useCardGroups();
  const { showToast } = useToast();

  const [newDialog, setNewDialog] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth()); // prev month (0-indexed so current-1)
  const [activePeriod, setActivePeriod] = useState<PeriodWithEntries | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PeriodWithEntries | null>(null);
  const [computing, setComputing] = useState(false);

  // Auto-select the most recent non-archived period
  useEffect(() => {
    if (!activePeriod && periods.length > 0) {
      const open = periods.find((p) => p.status !== 'archived');
      setActivePeriod(open || periods[0]);
    }
  }, [periods, activePeriod]);

  // Update active period when periods change
  useEffect(() => {
    if (activePeriod) {
      const updated = periods.find((p) => p.id === activePeriod.id);
      if (updated) setActivePeriod(updated);
    }
  }, [periods, activePeriod]);

  const handleCreatePeriod = async () => {
    const m = newMonth;
    const start = `${newYear}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(newYear, m + 1, 0).getDate();
    const end = `${newYear}-${String(m + 1).padStart(2, '0')}-${lastDay}`;
    const label = `${newYear}年${m + 1}月分`;

    try {
      const period = await createPeriod(label, start, end);
      setActivePeriod(null); // will auto-select
      setNewDialog(false);
      showToast(`${label}の照合を作成しました`);
    } catch {
      showToast('作成に失敗しました');
    }
  };

  const handleCompute = async () => {
    if (!activePeriod) return;
    setComputing(true);
    try {
      const actuals = await computeActuals(activePeriod.period_start, activePeriod.period_end, getBrandGroup);

      // Get all group labels (from actuals + existing entries)
      const allLabels = Array.from(new Set([
        ...Object.keys(actuals),
        ...activePeriod.reconciliation_entries.map((e) => e.group_label),
      ]));

      for (const label of allLabels) {
        const existing = activePeriod.reconciliation_entries.find((e) => e.group_label === label);
        const actualAmount = actuals[label] || 0;

        await upsertEntry({
          id: existing?.id,
          period_id: activePeriod.id,
          group_label: label,
          expected_amount: existing?.expected_amount ?? 0,
          actual_amount: actualAmount,
          status: existing?.expected_amount
            ? (actualAmount === existing.expected_amount ? 'matched' : 'mismatched')
            : 'pending',
          note: existing?.note,
        });
      }

      await updatePeriod(activePeriod.id, { status: 'reconciling' });
      showToast('売上集計を更新しました');
    } catch {
      showToast('集計に失敗しました');
    }
    setComputing(false);
  };

  const handleExpectedChange = async (entryId: string, value: number) => {
    const entry = activePeriod?.reconciliation_entries.find((e) => e.id === entryId);
    if (!entry || !activePeriod) return;

    const status = value === entry.actual_amount ? 'matched' : (value > 0 ? 'mismatched' : 'pending');
    await upsertEntry({
      id: entryId,
      period_id: activePeriod.id,
      group_label: entry.group_label,
      expected_amount: value,
      actual_amount: entry.actual_amount,
      status,
      note: entry.note,
    });
  };

  const handleNoteChange = async (entryId: string, note: string) => {
    const entry = activePeriod?.reconciliation_entries.find((e) => e.id === entryId);
    if (!entry || !activePeriod) return;

    await upsertEntry({
      id: entryId,
      period_id: activePeriod.id,
      group_label: entry.group_label,
      expected_amount: entry.expected_amount,
      actual_amount: entry.actual_amount,
      status: note ? 'resolved' : entry.status,
      note,
    });
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archivePeriod(archiveTarget.id, archiveTarget.period_start, archiveTarget.period_end);
      showToast(`${archiveTarget.period_label}を確定・アーカイブしました`);
      setArchiveTarget(null);
    } catch {
      showToast('アーカイブに失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">読み込み中...</span>
      </div>
    );
  }

  const entries = activePeriod?.reconciliation_entries || [];
  const totalActual = entries.reduce((s, e) => s + e.actual_amount, 0);
  const totalExpected = entries.reduce((s, e) => s + e.expected_amount, 0);
  const totalDiff = totalActual - totalExpected;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">入金照合</h1>
        <Button variant="outline" size="sm" onClick={() => setNewDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新規期間
        </Button>
      </div>

      {/* 期間タブ */}
      {periods.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {periods.map((p) => {
            const badge = getStatusBadge(p.status);
            const isActive = activePeriod?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePeriod(p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  isActive ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-primary-light/20'
                }`}
              >
                <span className="font-medium">{p.period_label}</span>
                <Badge variant={isActive ? 'secondary' : badge.variant} className="text-[10px]">
                  {badge.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* 照合テーブル */}
      {activePeriod ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompute}
              disabled={computing || activePeriod.status === 'archived'}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${computing ? 'animate-spin' : ''}`} />
              売上集計を更新
            </Button>
            {activePeriod.status !== 'archived' && entries.length > 0 && (
              <Button
                variant="success"
                size="sm"
                onClick={() => setArchiveTarget(activePeriod)}
              >
                <Archive className="h-4 w-4 mr-1" />
                確定・アーカイブ
              </Button>
            )}
            {activePeriod.status === 'archived' && (
              <span className="text-sm text-success font-semibold">
                確定済み（{activePeriod.confirmed_at ? new Date(activePeriod.confirmed_at).toLocaleDateString('ja-JP') : ''}）
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted">
              「売上集計を更新」をクリックして、対象期間の売上を集計してください
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-center px-3 py-2.5 font-semibold text-muted text-xs w-10"></th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">入金先</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted text-xs">売上合計</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted text-xs">入金額</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted text-xs">差額</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted text-xs">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const isArchived = activePeriod.status === 'archived';
                    return (
                      <tr key={e.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 text-center">{getEntryStatusIcon(e.status)}</td>
                        <td className="px-3 py-2 font-semibold">{e.group_label}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatYen(e.actual_amount)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {isArchived ? (
                            <span className="font-mono tabular-nums">{formatYen(e.expected_amount)}</span>
                          ) : (
                            <Input
                              type="number"
                              value={e.expected_amount || ''}
                              onChange={(ev) => handleExpectedChange(e.id, Number(ev.target.value) || 0)}
                              className="h-8 text-xs text-right w-28 inline-block"
                              placeholder="入金額"
                            />
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${
                          e.difference === 0 ? 'text-success' : 'text-accent'
                        }`}>
                          {e.expected_amount > 0 ? (
                            e.difference === 0 ? '一致' : formatYen(e.difference)
                          ) : '---'}
                        </td>
                        <td className="px-3 py-1.5">
                          {isArchived ? (
                            <span className="text-xs text-muted">{e.note || ''}</span>
                          ) : (
                            <Input
                              value={e.note || ''}
                              onChange={(ev) => handleNoteChange(e.id, ev.target.value)}
                              className="h-8 text-xs w-full"
                              placeholder="手数料、翌月回し等"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* 合計行 */}
                  <tr className="bg-primary-light/30 font-bold">
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5">合計</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatYen(totalActual)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatYen(totalExpected)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${totalDiff === 0 ? 'text-success' : 'text-accent'}`}>
                      {totalExpected > 0 ? (totalDiff === 0 ? '一致' : formatYen(totalDiff)) : '---'}
                    </td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-sm text-muted">
          「新規期間」から照合対象の月を作成してください
        </div>
      )}

      {/* 新規期間ダイアログ */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>照合期間を作成</DialogTitle>
            <DialogDescription>対象の年月を選択してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>年</Label>
                <Input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label>月</Label>
                <select
                  value={newMonth}
                  onChange={(e) => setNewMonth(Number(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm mt-1"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{i + 1}月</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNewDialog(false)}>キャンセル</Button>
              <Button onClick={handleCreatePeriod}>作成</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* アーカイブ確認ダイアログ */}
      <Dialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確定・アーカイブしますか？</DialogTitle>
            <DialogDescription>
              「{archiveTarget?.period_label}」の照合を確定し、対象取引をアーカイブします。
              アーカイブ後は取引の編集・削除ができなくなります。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>キャンセル</Button>
            <Button variant="success" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-1" />
              確定・アーカイブ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
