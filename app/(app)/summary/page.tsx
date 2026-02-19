'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAllTransactions } from '@/lib/hooks/use-all-transactions';
import { useCardGroups } from '@/lib/hooks/use-card-groups';
import { classifyPaymentCategory } from '@/lib/utils/normalize';
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
    return { default: () => null };
  }),
  { ssr: false }
);

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

function getQuickRange(key: string): { start: string; end: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (key) {
    case 'this_month': {
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const last = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${last}`;
      return { start, end };
    }
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const start = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
      const last = new Date(ly, lm + 1, 0).getDate();
      const end = `${ly}-${String(lm + 1).padStart(2, '0')}-${last}`;
      return { start, end };
    }
    case 'last_3months': {
      const d = new Date(y, m - 2, 1);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${last}`;
      return { start, end };
    }
    case 'this_fy': {
      // 日本の会計年度: 4月〜3月
      const fyStart = m >= 3 ? y : y - 1; // April=3(0-idx)
      const start = `${fyStart}-04-01`;
      const end = `${fyStart + 1}-03-31`;
      return { start, end };
    }
    default:
      return null;
  }
}

export default function SummaryPage() {
  const { transactions, loading } = useAllTransactions();
  const { getBrandGroup, loading: groupsLoading } = useCardGroups();
  const [pivotState, setPivotState] = useState<any>({});
  const [renderers, setRenderers] = useState<Record<string, any> | null>(null);

  // Date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Load renderers client-side
  useEffect(() => {
    getTableRenderers().then((r) => {
      if (r) setRenderers(createJaRenderers(r));
    });
  }, []);

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;
    return transactions.filter((t) => {
      if (!t.transaction_date) return false;
      if (startDate && t.transaction_date < startDate) return false;
      if (endDate && t.transaction_date > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Transform transactions to Japanese-labeled flat objects for pivot
  const pivotData = useMemo(() => {
    return filteredTransactions.map((t) => {
      const date = t.transaction_date || '';
      const [year, month] = date.split('-');
      const category = classifyPaymentCategory(t.payment_type, t.installment_count);
      return {
        '取引日': date || '不明',
        '年': year || '不明',
        '年月': year && month ? `${year}/${month}` : '不明',
        '月': month ? `${Number(month)}月` : '不明',
        'カード会社': t.card_brand || '不明',
        '入金先': getBrandGroup(t.card_brand),
        '区分': t.transaction_content || '売上',
        '支払区分': category,
        '金額': t.amount || 0,
        '伝票番号': t.slip_number || '',
        '支払方法': t.payment_type || '',
        '端末番号': t.terminal_number || '',
        '係員': t.clerk || '',
        '状態': t.archived_period_id ? 'アーカイブ済' : '未確定',
      };
    });
  }, [filteredTransactions, getBrandGroup]);

  const handleQuick = (key: string) => {
    if (key === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const range = getQuickRange(key);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  if (loading || groupsLoading || !renderers) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 summary-full-width">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">集計・ピボットテーブル</h1>
        <p className="text-sm text-muted">項目をドラッグして行・列に配置してください</p>
      </div>

      {/* 日付フィルタ */}
      <div className="bg-card rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted">期間:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background"
          />
          <span className="text-xs text-muted">〜</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background"
          />
          {(startDate || endDate) && (
            <span className="text-xs text-muted ml-1">
              ({filteredTransactions.length}/{transactions.length}件)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted">クイック:</span>
          {[
            { key: 'this_month', label: '今月' },
            { key: 'last_month', label: '先月' },
            { key: 'last_3months', label: '過去3ヶ月' },
            { key: 'this_fy', label: '今年度' },
            { key: 'all', label: 'すべて' },
          ].map((q) => (
            <Button
              key={q.key}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => handleQuick(q.key)}
            >
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 overflow-auto pivot-container">
        <PivotTableUI
          vals={['金額']}
          aggregatorName="合計"
          rendererName="テーブル"
          {...pivotState}
          data={pivotData}
          onChange={(s: any) => {
            const { data: _data, aggregators: _agg, renderers: _rend, localeStrings: _loc, ...rest } = s;
            setPivotState(rest);
          }}
          renderers={renderers}
          aggregators={jaAggregators}
          localeStrings={jaLocaleStrings}
        />
      </div>
    </div>
  );
}
