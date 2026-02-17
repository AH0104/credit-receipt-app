'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Settings, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { usePresets } from '@/lib/hooks/use-presets';
import { useAggregation } from '@/lib/hooks/use-aggregation';
import { getBrandInfo, formatYen } from '@/lib/constants/card-brands';
import {
  GROUP_BY_OPTIONS,
  AGGREGATION_FN_OPTIONS,
  type AggregationPreset,
  type AggregationSpec,
  type GroupByColumn,
  type DateFilterMode,
} from '@/lib/types/aggregation';
import { cn } from '@/lib/utils';

export default function SummaryPage() {
  const { presets, loading: presetsLoading, create, update, remove: removePreset } = usePresets();
  const { results, loading: aggLoading, runAggregation } = useAggregation();
  const { showToast } = useToast();

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // プリセット編集ダイアログ
  const [showEditor, setShowEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AggregationPreset | null>(null);
  const [editorStep, setEditorStep] = useState(1);
  const [editorName, setEditorName] = useState('');
  const [editorGroupBy, setEditorGroupBy] = useState<GroupByColumn[]>(['transaction_date']);
  const [editorAggregations, setEditorAggregations] = useState<AggregationSpec[]>([
    { field: 'amount', function: 'sum', label: '合計金額' },
    { field: 'amount', function: 'count', label: '件数' },
  ]);
  const [editorDateFilter, setEditorDateFilter] = useState<DateFilterMode>('all');

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<AggregationPreset | null>(null);

  const activePreset = presets.find((p) => p.id === activePresetId) || presets[0];

  // デフォルトプリセットの自動選択
  useEffect(() => {
    if (!activePresetId && presets.length > 0) {
      const def = presets.find((p) => p.is_default) || presets[0];
      setActivePresetId(def.id);
    }
  }, [presets, activePresetId]);

  // 集計実行
  const executeAggregation = useCallback(async () => {
    if (!activePreset) return;

    let from: string | null = null;
    let to: string | null = null;

    if (activePreset.date_filter_mode === 'month') {
      from = `${selectedMonth}-01`;
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    } else if (activePreset.date_filter_mode === 'range') {
      from = dateFrom || null;
      to = dateTo || null;
    }

    await runAggregation(activePreset, from, to);
  }, [activePreset, selectedMonth, dateFrom, dateTo, runAggregation]);

  useEffect(() => {
    if (activePreset) {
      executeAggregation();
    }
  }, [activePreset?.id, selectedMonth, dateFrom, dateTo]);

  // 月移動
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  };

  // プリセット編集ダイアログを開く
  const openEditor = (preset?: AggregationPreset) => {
    if (preset) {
      setEditingPreset(preset);
      setEditorName(preset.name);
      setEditorGroupBy([...preset.group_by]);
      setEditorAggregations([...preset.aggregations]);
      setEditorDateFilter(preset.date_filter_mode);
    } else {
      setEditingPreset(null);
      setEditorName('');
      setEditorGroupBy(['transaction_date']);
      setEditorAggregations([
        { field: 'amount', function: 'sum', label: '合計金額' },
        { field: 'amount', function: 'count', label: '件数' },
      ]);
      setEditorDateFilter('all');
    }
    setEditorStep(1);
    setShowEditor(true);
  };

  // プリセット保存
  const savePreset = async () => {
    if (!editorName.trim()) {
      showToast('名前を入力してください');
      return;
    }

    try {
      if (editingPreset) {
        await update(editingPreset.id, {
          name: editorName,
          group_by: editorGroupBy,
          aggregations: editorAggregations,
          date_filter_mode: editorDateFilter,
        });
        showToast('プリセットを更新しました');
      } else {
        const created = await create({
          name: editorName,
          description: null,
          group_by: editorGroupBy,
          aggregations: editorAggregations,
          date_filter_mode: editorDateFilter,
          sort_column: editorGroupBy[0] || 'transaction_date',
          sort_direction: 'desc',
          is_default: false,
          display_order: presets.length,
        });
        setActivePresetId(created.id);
        showToast('プリセットを作成しました');
      }
      setShowEditor(false);
    } catch {
      showToast('保存に失敗しました');
    }
  };

  const confirmDeletePreset = async () => {
    if (!deleteTarget) return;
    try {
      await removePreset(deleteTarget.id);
      if (activePresetId === deleteTarget.id) {
        setActivePresetId(null);
      }
      showToast('プリセットを削除しました');
    } catch {
      showToast('削除に失敗しました');
    }
    setDeleteTarget(null);
  };

  // グループ化列の日本語ラベル取得
  const getColumnLabel = (col: string) =>
    GROUP_BY_OPTIONS.find((o) => o.value === col)?.label || col;

  // 月表示用フォーマット
  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${y}年${parseInt(mo)}月`;
  };

  // 合計行の計算
  const grandTotal = results.reduce((sum, r) => {
    const amountKey = activePreset?.aggregations.find((a) => a.function === 'sum')?.label;
    if (amountKey && typeof r[amountKey] === 'number') {
      return sum + (r[amountKey] as number);
    }
    return sum;
  }, 0);

  if (presetsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* プリセット選択 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePresetId(p.id)}
            onDoubleClick={() => openEditor(p)}
            className={cn(
              'whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-colors shrink-0',
              activePresetId === p.id
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-foreground hover:bg-primary-light'
            )}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => openEditor()}
          className="whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium border-2 border-dashed border-border text-muted hover:border-primary hover:text-primary transition-colors shrink-0 flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          新しい集計
        </button>
      </div>

      {/* アクティブプリセットの編集ボタン */}
      {activePreset && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditor(activePreset)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            設定を変更
          </Button>
          {!activePreset.is_default && (
            <Button variant="ghost" size="sm" className="text-accent" onClick={() => setDeleteTarget(activePreset)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              削除
            </Button>
          )}
        </div>
      )}

      {/* 日付フィルタ */}
      {activePreset?.date_filter_mode === 'month' && (
        <div className="flex items-center justify-center gap-3 bg-card rounded-xl border border-border p-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-primary-light rounded-lg transition-colors">
            <ChevronLeft className="h-5 w-5 text-primary" />
          </button>
          <span className="text-base font-bold text-foreground min-w-[120px] text-center">
            {formatMonth(selectedMonth)}
          </span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-primary-light rounded-lg transition-colors">
            <ChevronRight className="h-5 w-5 text-primary" />
          </button>
        </div>
      )}

      {activePreset?.date_filter_mode === 'range' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">開始日</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">終了日</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
          </div>
        </div>
      )}

      {/* 集計結果 */}
      {aggLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
          <span className="ml-2 text-sm text-muted">集計中...</span>
        </div>
      ) : results.length === 0 ? (
        <Card className="py-10">
          <CardContent className="text-center">
            <div className="text-3xl mb-3">📊</div>
            <p className="text-sm text-muted">データがありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {results.map((row, idx) => {
            // グループ化列の値を取得
            const groupLabels = activePreset?.group_by.map((col) => {
              const val = row[col];
              if (col === 'card_brand' && val) {
                return { col, val: String(val), brand: getBrandInfo(String(val)) };
              }
              return { col, val: String(val || '不明'), brand: null };
            }) || [];

            // 集計値を取得
            const aggValues = activePreset?.aggregations.map((a) => ({
              label: a.label,
              value: row[a.label],
              fn: a.function,
            })) || [];

            const mainAmount = aggValues.find((v) => v.fn === 'sum');
            const subValues = aggValues.filter((v) => v !== mainAmount);

            return (
              <Card key={idx}>
                <CardContent className="p-4">
                  {/* グループヘッダー */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {groupLabels.map((g, i) => (
                      <span key={i}>
                        {g.brand ? (
                          <span
                            className="inline-flex items-center justify-center w-11 h-6 rounded text-white text-[10px] font-bold"
                            style={{ backgroundColor: g.brand.color }}
                          >
                            {g.brand.label}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-foreground">{g.val}</span>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* メイン金額 */}
                  <div className="flex items-end justify-between">
                    <div>
                      {mainAmount && (
                        <div className="text-xl font-bold text-primary">
                          {formatYen(Number(mainAmount.value) || 0)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {subValues.map((v, i) => (
                        <div key={i} className="text-right">
                          <div className="text-[10px] text-muted">{v.label}</div>
                          <div className="text-sm font-semibold text-foreground">
                            {v.fn === 'count'
                              ? `${v.value}件`
                              : v.fn === 'avg'
                                ? formatYen(Math.round(Number(v.value) || 0))
                                : formatYen(Number(v.value) || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* 全体合計 */}
          {grandTotal !== 0 && (
            <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
              <span className="text-white/80 font-semibold text-sm">合計</span>
              <span className="text-white text-xl font-bold">{formatYen(grandTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* プリセット編集ダイアログ */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? 'プリセットを編集' : '新しい集計を作成'}
            </DialogTitle>
            <DialogDescription>
              ステップ {editorStep} / 3
            </DialogDescription>
          </DialogHeader>

          {editorStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">集計の名前</Label>
                <Input
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="例: 月別カード会社別"
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-3 block">何でまとめる？</Label>
                <p className="text-xs text-muted mb-3">データをどの項目でグループ分けするか選んでください（複数OK）</p>
                <div className="space-y-2">
                  {GROUP_BY_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary-light/30 cursor-pointer">
                      <Checkbox
                        checked={editorGroupBy.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditorGroupBy([...editorGroupBy, opt.value]);
                          } else {
                            setEditorGroupBy(editorGroupBy.filter((v) => v !== opt.value));
                          }
                        }}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button size="full" onClick={() => setEditorStep(2)} disabled={editorGroupBy.length === 0}>
                次へ
              </Button>
            </div>
          )}

          {editorStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">何を計算する？</Label>
                <p className="text-xs text-muted mb-3">金額をどのように集計するか選んでください</p>
                <div className="space-y-2">
                  {AGGREGATION_FN_OPTIONS.map((fn) => {
                    const isSelected = editorAggregations.some((a) => a.function === fn.value);
                    return (
                      <label key={fn.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary-light/30 cursor-pointer">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditorAggregations([
                                ...editorAggregations,
                                { field: 'amount', function: fn.value, label: fn.label === '件数' ? '件数' : `${fn.label}金額` },
                              ]);
                            } else {
                              setEditorAggregations(
                                editorAggregations.filter((a) => a.function !== fn.value)
                              );
                            }
                          }}
                        />
                        <span className="text-sm">{fn.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="full" onClick={() => setEditorStep(1)}>
                  戻る
                </Button>
                <Button size="full" onClick={() => setEditorStep(3)} disabled={editorAggregations.length === 0}>
                  次へ
                </Button>
              </div>
            </div>
          )}

          {editorStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">期間の設定</Label>
                <p className="text-xs text-muted mb-3">データをどの期間で表示するか選んでください</p>
                <div className="space-y-2">
                  {[
                    { value: 'all' as const, label: '全期間', desc: 'すべてのデータを表示' },
                    { value: 'month' as const, label: '月ごと', desc: '月を選択して表示' },
                    { value: 'range' as const, label: '期間指定', desc: '開始日と終了日を指定' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors',
                        editorDateFilter === opt.value
                          ? 'border-primary bg-primary-light/30'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <input
                        type="radio"
                        name="dateFilter"
                        checked={editorDateFilter === opt.value}
                        onChange={() => setEditorDateFilter(opt.value)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="full" onClick={() => setEditorStep(2)}>
                  戻る
                </Button>
                <Button size="full" onClick={savePreset}>
                  {editingPreset ? '更新する' : '作成する'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>プリセットを削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDeletePreset}>
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
