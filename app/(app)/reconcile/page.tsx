'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Archive, Loader2, RefreshCw, ChevronRight, ChevronDown, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useReconciliation, type PeriodWithEntries, type GroupActual } from '@/lib/hooks/use-reconciliation';
import { useCardGroups } from '@/lib/hooks/use-card-groups';
import { formatYen } from '@/lib/constants/card-brands';
import { RoleGuard } from '@/components/auth/role-guard';
import type { ReconciliationEntry } from '@/lib/types/reconciliation';
import { parseGroupLabel, computeBalance } from '@/lib/types/reconciliation';
import type { PaymentCategory } from '@/lib/utils/normalize';

// ─── ステータス表示 ─────────────────────────────

function getPaymentStatusInfo(status: string) {
  switch (status) {
    case 'received': return { icon: '✅', label: '消込完了', color: 'text-success' };
    case 'partial': return { icon: '⚠', label: '一部入金', color: 'text-warning' };
    case 'overdue': return { icon: '🔴', label: '延滞', color: 'text-accent' };
    case 'written_off': return { icon: '✖', label: '貸倒', color: 'text-muted' };
    default: return { icon: '⏳', label: '未入金', color: 'text-muted' };
  }
}

function getPeriodStatusBadge(status: string) {
  switch (status) {
    case 'open': return { label: '未着手', variant: 'secondary' as const };
    case 'reconciling': return { label: '照合中', variant: 'warning' as const };
    case 'archived': return { label: '確定済', variant: 'success' as const };
    default: return { label: status, variant: 'secondary' as const };
  }
}

function getCategoryBadge(category: string) {
  switch (category) {
    case '一括': return { color: 'bg-blue-100 text-blue-700' };
    case '2回': return { color: 'bg-yellow-100 text-yellow-700' };
    case 'その他': return { color: 'bg-gray-100 text-gray-600' };
    case 'ボーナス': return { color: 'bg-purple-100 text-purple-700' };
    default: return { color: 'bg-gray-100 text-gray-600' };
  }
}

function derivePaymentStatus(
  entry: ReconciliationEntry,
  expectedPaymentDate: string | null
): ReconciliationEntry['payment_status'] {
  const balance = computeBalance(entry);
  const { category } = parseGroupLabel(entry.group_label);

  if (balance === 0 && entry.expected_amount > 0) return 'received';
  if (entry.expected_amount > 0 && balance > 0) return 'partial';
  // 延滞判定は一括のみ（分割・ボーナスは繰越が前提）
  if (category === '一括' && expectedPaymentDate) {
    const payDate = new Date(expectedPaymentDate);
    const now = new Date();
    if (payDate < now && entry.expected_amount === 0 && entry.actual_amount > 0) return 'overdue';
  }
  return 'pending';
}

// ─── エントリー行コンポーネント ──────────────────

function EntryRow({
  entry: e,
  isArchived,
  brandBreakdown,
  expectedPaymentDate,
  onFieldBlur,
}: {
  entry: ReconciliationEntry;
  isArchived: boolean;
  brandBreakdown: GroupActual | undefined;
  expectedPaymentDate: string | null;
  onFieldBlur: (fields: Partial<ReconciliationEntry>) => void;
}) {
  const { group, category } = parseGroupLabel(e.group_label);
  const catBadge = getCategoryBadge(category);
  const balance = computeBalance(e);
  const status = derivePaymentStatus(e, expectedPaymentDate);
  const statusInfo = getPaymentStatusInfo(status);
  const hasBrands = brandBreakdown && brandBreakdown.brands.length > 1;

  const [expanded, setExpanded] = useState(false);
  const [expectedLocal, setExpectedLocal] = useState(e.expected_amount ? String(e.expected_amount) : '');
  const [feeLocal, setFeeLocal] = useState(e.fee_amount ? String(e.fee_amount) : '');
  const [noteLocal, setNoteLocal] = useState(e.note || '');

  // Sync from server
  useEffect(() => {
    setExpectedLocal(e.expected_amount ? String(e.expected_amount) : '');
  }, [e.expected_amount]);
  useEffect(() => {
    setFeeLocal(e.fee_amount ? String(e.fee_amount) : '');
  }, [e.fee_amount]);
  useEffect(() => {
    setNoteLocal(e.note || '');
  }, [e.note]);

  const handleExpectedBlur = () => {
    const val = Number(expectedLocal) || 0;
    if (val !== e.expected_amount) {
      onFieldBlur({ expected_amount: val });
    }
  };

  const handleFeeBlur = () => {
    const val = Number(feeLocal) || 0;
    if (val !== e.fee_amount) {
      onFieldBlur({ fee_amount: val });
    }
  };

  const handleNoteBlur = () => {
    if (noteLocal !== (e.note || '')) {
      onFieldBlur({ note: noteLocal });
    }
  };

  return (
    <>
      <tr className="border-b border-border last:border-b-0 hover:bg-background/30">
        {/* ステータス */}
        <td className="px-2 py-2 text-center w-8">
          <span className={statusInfo.color} title={statusInfo.label}>{statusInfo.icon}</span>
        </td>
        {/* 展開ボタン + 入金先 */}
        <td className="px-2 py-2 font-semibold whitespace-nowrap">
          <div className="flex items-center gap-1">
            {hasBrands ? (
              <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-primary-light/30 rounded">
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            {group}
          </div>
        </td>
        {/* 区分 */}
        <td className="px-2 py-2">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${catBadge.color}`}>
            {category}
          </span>
        </td>
        {/* 売上合計 */}
        <td className="px-2 py-2 text-right font-mono tabular-nums">{formatYen(e.actual_amount)}</td>
        {/* 繰越 */}
        <td className="px-2 py-2 text-right font-mono tabular-nums">
          {e.carryover_amount > 0 ? (
            <span className="text-warning">
              {formatYen(e.carryover_amount)}
              <span className="text-[9px] ml-0.5">前期↗</span>
            </span>
          ) : (
            <span className="text-muted">¥0</span>
          )}
        </td>
        {/* 入金額 */}
        <td className="px-2 py-1.5 text-right">
          {isArchived ? (
            <span className="font-mono tabular-nums">{formatYen(e.expected_amount)}</span>
          ) : (
            <Input
              type="number"
              value={expectedLocal}
              onChange={(ev) => setExpectedLocal(ev.target.value)}
              onBlur={handleExpectedBlur}
              className="h-7 text-xs text-right w-24 inline-block"
              placeholder="入金額"
            />
          )}
        </td>
        {/* 手数料 */}
        <td className="px-2 py-1.5 text-right">
          {isArchived ? (
            <span className="font-mono tabular-nums">{formatYen(e.fee_amount)}</span>
          ) : (
            <Input
              type="number"
              value={feeLocal}
              onChange={(ev) => setFeeLocal(ev.target.value)}
              onBlur={handleFeeBlur}
              className="h-7 text-xs text-right w-20 inline-block"
              placeholder="手数料"
            />
          )}
        </td>
        {/* 差引残 */}
        <td className={`px-2 py-2 text-right font-mono tabular-nums font-semibold ${
          balance === 0 && e.expected_amount > 0 ? 'text-success' : balance > 0 ? 'text-accent' : 'text-muted'
        }`}>
          {e.expected_amount > 0 || e.fee_amount > 0 ? (
            balance === 0 ? '¥0 ✓' : formatYen(balance)
          ) : '---'}
        </td>
        {/* メモ */}
        <td className="px-2 py-1.5">
          {isArchived ? (
            <span className="text-xs text-muted">{e.note || ''}</span>
          ) : (
            <Input
              value={noteLocal}
              onChange={(ev) => setNoteLocal(ev.target.value)}
              onBlur={handleNoteBlur}
              className="h-7 text-xs w-full min-w-[80px]"
              placeholder="メモ"
            />
          )}
        </td>
      </tr>
      {/* ブランド内訳展開 */}
      {expanded && hasBrands && brandBreakdown.brands.map((b) => (
        <tr key={b.brand} className="border-b border-border/50 bg-background/20">
          <td className="px-2 py-1"></td>
          <td className="px-2 py-1 pl-10 text-xs text-muted">
            {b.brand === brandBreakdown.brands[brandBreakdown.brands.length - 1].brand ? '└' : '├'} {b.brand}
          </td>
          <td className="px-2 py-1"></td>
          <td className="px-2 py-1 text-right font-mono tabular-nums text-xs text-muted">{formatYen(b.amount)}</td>
          <td className="px-2 py-1" colSpan={5}></td>
        </tr>
      ))}
    </>
  );
}

// ─── メインページ ─────────────────────────────

export default function ReconcilePage() {
  const {
    periods, loading, createPeriod, updatePeriod, deletePeriod,
    upsertEntry, archivePeriod, computeActuals, getCarryovers,
  } = useReconciliation();
  const { getBrandGroup } = useCardGroups();
  const { showToast } = useToast();

  // Dialog state
  const [newDialog, setNewDialog] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [newPeriodType, setNewPeriodType] = useState<'first_half' | 'second_half'>('first_half');

  // Active period
  const [activePeriod, setActivePeriod] = useState<PeriodWithEntries | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PeriodWithEntries | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PeriodWithEntries | null>(null);
  const [computing, setComputing] = useState(false);

  // Brand breakdown cache (from latest computeActuals)
  const [brandData, setBrandData] = useState<GroupActual[]>([]);

  // Auto-select the most recent non-archived period, or sync active period after refetch
  useEffect(() => {
    if (periods.length === 0) return;
    setActivePeriod((prev) => {
      if (!prev) {
        const open = periods.find((p) => p.status !== 'archived');
        return open || periods[0];
      }
      return periods.find((p) => p.id === prev.id) || prev;
    });
  }, [periods]);

  // Compute expected payment date display
  const expectedPaymentLabel = useMemo(() => {
    if (!activePeriod?.expected_payment_date) return null;
    const d = new Date(activePeriod.expected_payment_date + 'T00:00:00');
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [activePeriod]);

  const isOverdue = useMemo(() => {
    if (!activePeriod?.expected_payment_date) return false;
    return new Date(activePeriod.expected_payment_date) < new Date() && activePeriod.status !== 'archived';
  }, [activePeriod]);

  // ─── Handlers ─────────────────────────────

  const handleCreatePeriod = async () => {
    try {
      await createPeriod(newYear, newMonth, newPeriodType);
      setActivePeriod(null); // will auto-select
      setNewDialog(false);
      showToast('照合期間を作成しました');
    } catch {
      showToast('作成に失敗しました');
    }
  };

  const handleCompute = async () => {
    if (!activePeriod) return;
    setComputing(true);
    try {
      // 1. 売上集計
      const actuals = await computeActuals(activePeriod.period_start, activePeriod.period_end, getBrandGroup);
      setBrandData(actuals);

      // 2. 繰越取得
      const carryovers = await getCarryovers(activePeriod.period_start);

      // 3. 全group_labelを収集（actuals + 繰越 + 既存entries）
      const allLabels = Array.from(new Set([
        ...actuals.map((a) => a.groupLabel),
        ...Object.keys(carryovers),
        ...activePeriod.reconciliation_entries.map((e) => e.group_label),
      ]));

      for (const label of allLabels) {
        const existing = activePeriod.reconciliation_entries.find((e) => e.group_label === label);
        const actual = actuals.find((a) => a.groupLabel === label);
        const actualAmount = actual?.totalAmount || 0;
        const carryover = carryovers[label] || 0;

        // 0円バグ修正: 売上0＋繰越0＋既存入金額0 → スキップ
        if (actualAmount === 0 && carryover === 0 && (!existing || (existing.expected_amount === 0 && existing.fee_amount === 0))) {
          continue;
        }

        await upsertEntry({
          id: existing?.id,
          period_id: activePeriod.id,
          group_label: label,
          actual_amount: actualAmount,
          carryover_amount: carryover,
          expected_amount: existing?.expected_amount ?? 0,
          fee_amount: existing?.fee_amount ?? 0,
          payment_status: existing?.payment_status ?? 'pending',
          status: existing?.status ?? 'pending',
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

  const handleFieldBlur = async (entry: ReconciliationEntry, fields: Partial<ReconciliationEntry>) => {
    if (!activePeriod) return;

    const updated = { ...entry, ...fields };
    const paymentStatus = derivePaymentStatus(
      updated as ReconciliationEntry,
      activePeriod.expected_payment_date
    );

    await upsertEntry({
      id: entry.id,
      period_id: activePeriod.id,
      group_label: entry.group_label,
      expected_amount: updated.expected_amount ?? entry.expected_amount,
      actual_amount: entry.actual_amount,
      carryover_amount: entry.carryover_amount,
      fee_amount: updated.fee_amount ?? entry.fee_amount,
      payment_status: paymentStatus,
      status: entry.status,
      note: updated.note !== undefined ? updated.note : entry.note,
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePeriod(deleteTarget.id);
      if (activePeriod?.id === deleteTarget.id) setActivePeriod(null);
      showToast(`${deleteTarget.period_label}を削除しました`);
      setDeleteTarget(null);
    } catch {
      showToast('削除に失敗しました');
    }
  };

  // ─── Loading ──────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">読み込み中...</span>
      </div>
    );
  }

  // ─── Derived data ─────────────────────────

  const entries = activePeriod?.reconciliation_entries || [];
  const totalActual = entries.reduce((s, e) => s + e.actual_amount, 0);
  const totalExpected = entries.reduce((s, e) => s + e.expected_amount, 0);
  const totalFee = entries.reduce((s, e) => s + e.fee_amount, 0);
  const totalCarryover = entries.reduce((s, e) => s + e.carryover_amount, 0);
  const totalBalance = entries.reduce((s, e) => s + computeBalance(e), 0);
  const overdueCount = entries.filter((e) => derivePaymentStatus(e, activePeriod?.expected_payment_date ?? null) === 'overdue').length;

  // Compute expected payment date for new period dialog
  const newPeriodExpectedDate = useMemo(() => {
    const lastDay = new Date(newYear, newMonth, 0).getDate();
    if (newPeriodType === 'first_half') {
      return `${newYear}/${newMonth}/${lastDay}`;
    } else {
      const nm = newMonth === 12 ? 1 : newMonth + 1;
      const ny = newMonth === 12 ? newYear + 1 : newYear;
      return `${ny}/${nm}/15`;
    }
  }, [newYear, newMonth, newPeriodType]);

  // ─── Render ───────────────────────────────

  return (
    <RoleGuard require="canReconcile">
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">入金照合</h1>
        <Button variant="outline" size="sm" onClick={() => setNewDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新規期間
        </Button>
      </div>

      {/* サマリーカード（未アーカイブ全期間の合計） */}
      {periods.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="text-[10px] text-muted font-semibold">売上合計</div>
            <div className="text-lg font-bold font-mono tabular-nums">{formatYen(totalActual)}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="text-[10px] text-muted font-semibold">入金済</div>
            <div className="text-lg font-bold font-mono tabular-nums text-success">{formatYen(totalExpected)}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="text-[10px] text-muted font-semibold">手数料</div>
            <div className="text-lg font-bold font-mono tabular-nums">{formatYen(totalFee)}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="text-[10px] text-muted font-semibold">差引残高</div>
            <div className={`text-lg font-bold font-mono tabular-nums ${totalBalance > 0 ? 'text-accent' : 'text-success'}`}>
              {formatYen(totalBalance)}
            </div>
            {overdueCount > 0 && (
              <div className="text-[10px] text-accent font-semibold mt-0.5">⚠ 延滞{overdueCount}件</div>
            )}
          </div>
        </div>
      )}

      {/* 期間タブ */}
      {periods.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {periods.map((p) => {
            const badge = getPeriodStatusBadge(p.status);
            const isActive = activePeriod?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePeriod(p)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  isActive ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-primary-light/20'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-xs">{p.period_label}</span>
                  <Badge variant={isActive ? 'secondary' : badge.variant} className="text-[9px] px-1 py-0">
                    {badge.label}
                  </Badge>
                </div>
                {p.expected_payment_date && (
                  <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-muted'}`}>
                    予定:{p.expected_payment_date}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 照合テーブル */}
      {activePeriod ? (
        <div className="space-y-3">
          {/* 期間ヘッダー */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold">{activePeriod.period_label}</span>
              {expectedPaymentLabel && (
                <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-accent font-bold' : 'text-muted'}`}>
                  <Calendar className="h-3.5 w-3.5" />
                  入金予定: {expectedPaymentLabel}
                  {isOverdue && ' （入金遅延）'}
                </span>
              )}
              {activePeriod.status === 'archived' && activePeriod.confirmed_at && (
                <span className="text-xs text-success font-semibold">
                  確定済（{new Date(activePeriod.confirmed_at).toLocaleDateString('ja-JP')}）
                </span>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2 flex-wrap">
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
            {activePeriod.status !== 'archived' && (
              <Button
                variant="outline"
                size="sm"
                className="text-accent hover:text-accent"
                onClick={() => setDeleteTarget(activePeriod)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted">
              「売上集計を更新」をクリックして、対象期間の売上を集計してください
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-center px-2 py-2 font-semibold text-muted text-[10px] w-8"></th>
                    <th className="text-left px-2 py-2 font-semibold text-muted text-[10px]">入金先</th>
                    <th className="text-left px-2 py-2 font-semibold text-muted text-[10px]">区分</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted text-[10px]">売上合計</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted text-[10px]">繰越</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted text-[10px]">入金額</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted text-[10px]">手数料</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted text-[10px]">差引残</th>
                    <th className="text-left px-2 py-2 font-semibold text-muted text-[10px]">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      isArchived={activePeriod.status === 'archived'}
                      brandBreakdown={brandData.find((b) => b.groupLabel === e.group_label)}
                      expectedPaymentDate={activePeriod.expected_payment_date}
                      onFieldBlur={(fields) => handleFieldBlur(e, fields)}
                    />
                  ))}
                  {/* 合計行 */}
                  <tr className="bg-primary-light/30 font-bold border-t-2 border-border">
                    <td className="px-2 py-2.5"></td>
                    <td className="px-2 py-2.5" colSpan={2}>合計</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums">{formatYen(totalActual)}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                      {totalCarryover > 0 ? formatYen(totalCarryover) : ''}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums">{formatYen(totalExpected)}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums">{formatYen(totalFee)}</td>
                    <td className={`px-2 py-2.5 text-right font-mono tabular-nums ${
                      totalBalance === 0 ? 'text-success' : 'text-accent'
                    }`}>
                      {totalExpected > 0 || totalFee > 0 ? formatYen(totalBalance) : '---'}
                    </td>
                    <td className="px-2 py-2.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 差引残の説明 */}
          {entries.length > 0 && (
            <div className="text-[10px] text-muted">
              差引残 = 売上合計 + 繰越 − 入金額 − 手数料　｜　差引残 &gt; 0 → 次期に自動繰越
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-sm text-muted">
          「新規期間」から照合対象の期間を作成してください
        </div>
      )}

      {/* 新規期間ダイアログ */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>照合期間を作成</DialogTitle>
            <DialogDescription>対象の年月と期間を選択してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 前半/後半 */}
            <div className="space-y-2">
              <Label>期間</Label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                newPeriodType === 'first_half' ? 'border-primary bg-primary-light/20' : 'border-border hover:bg-background/50'
              }`}>
                <input
                  type="radio"
                  name="periodType"
                  value="first_half"
                  checked={newPeriodType === 'first_half'}
                  onChange={() => setNewPeriodType('first_half')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold">前半（1日〜15日）</div>
                  <div className="text-xs text-muted">入金予定日: {newPeriodType === 'first_half' ? newPeriodExpectedDate : ''}</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                newPeriodType === 'second_half' ? 'border-primary bg-primary-light/20' : 'border-border hover:bg-background/50'
              }`}>
                <input
                  type="radio"
                  name="periodType"
                  value="second_half"
                  checked={newPeriodType === 'second_half'}
                  onChange={() => setNewPeriodType('second_half')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold">後半（16日〜{new Date(newYear, newMonth, 0).getDate()}日）</div>
                  <div className="text-xs text-muted">入金予定日: {newPeriodType === 'second_half' ? newPeriodExpectedDate : ''}</div>
                </div>
              </label>
            </div>

            <div className="text-xs text-muted bg-background/50 rounded-lg p-2">
              ※ 前期の差引残は自動繰越されます
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

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>期間を削除しますか？</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.period_label}」とそのエントリを削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RoleGuard>
  );
}
