'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { jaAggregators, jaLocaleStrings } from '@/lib/pivot-locale-ja';
import 'react-pivottable/pivottable.css';

// PivotTableUI must be loaded client-side only (uses DOM drag-and-drop)
const PivotTableUI = dynamic(() => import('react-pivottable/PivotTableUI'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted" />
      <span className="ml-2 text-sm text-muted">ピボットテーブルを読み込み中...</span>
    </div>
  ),
});

const TableRenderers = dynamic(
  () => import('react-pivottable/TableRenderers').then((mod) => {
    // TableRenderers is a plain object, not a component.
    // We store it and return a dummy component - actual use is via renderers prop.
    return { default: () => null };
  }),
  { ssr: false }
);

// We need to import TableRenderers synchronously for the renderers prop.
// Use a wrapper that lazy-loads it.
let _tableRenderers: Record<string, any> | null = null;
const getTableRenderers = async () => {
  if (!_tableRenderers) {
    const mod = await import('react-pivottable/TableRenderers');
    _tableRenderers = mod.default;
  }
  return _tableRenderers;
};

// Japanese renderer names
const jaRendererNames: Record<string, string> = {
  'Table': 'テーブル',
  'Table Heatmap': 'テーブル（ヒートマップ）',
  'Table Col Heatmap': 'テーブル（列ヒートマップ）',
  'Table Row Heatmap': 'テーブル（行ヒートマップ）',
};

function createJaRenderers(renderers: Record<string, any>) {
  const ja: Record<string, any> = {};
  for (const [key, val] of Object.entries(renderers)) {
    const jaName = jaRendererNames[key] || key;
    ja[jaName] = val;
  }
  return ja;
}

export default function SummaryPage() {
  const { transactions, loading } = useTransactions();
  const [pivotState, setPivotState] = useState<any>({});
  const [renderers, setRenderers] = useState<Record<string, any> | null>(null);

  // Load renderers client-side
  useEffect(() => {
    getTableRenderers().then((r) => {
      if (r) setRenderers(createJaRenderers(r));
    });
  }, []);

  // Transform transactions to Japanese-labeled flat objects for pivot
  const pivotData = useMemo(() => {
    return transactions.map((t) => ({
      '取引日': t.transaction_date || '不明',
      'カード会社': t.card_brand || '不明',
      '区分': t.transaction_content || '売上',
      '金額': t.amount || 0,
      '伝票番号': t.slip_number || '',
      '支払方法': t.payment_type || '',
      '端末番号': t.terminal_number || '',
      '係員': t.clerk || '',
    }));
  }, [transactions]);

  if (loading || !renderers) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">集計・ピボットテーブル</h1>
        <p className="text-sm text-muted">項目をドラッグして行・列に配置してください</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 overflow-auto pivot-container">
        <PivotTableUI
          data={pivotData}
          onChange={(s: any) => setPivotState(s)}
          renderers={renderers}
          aggregators={jaAggregators}
          localeStrings={jaLocaleStrings}
          vals={['金額']}
          aggregatorName="合計"
          rendererName="テーブル"
          {...pivotState}
        />
      </div>
    </div>
  );
}
