// eslint-disable-next-line @typescript-eslint/no-var-requires
const { aggregatorTemplates } = require('react-pivottable/Utilities') as {
  aggregatorTemplates: Record<string, any>;
};

const jpFmt = (x: number) =>
  isNaN(x) || !isFinite(x) ? '' : '¥' + Math.round(x).toLocaleString();
const jpFmtInt = (x: number) =>
  isNaN(x) || !isFinite(x) ? '' : Math.round(x).toLocaleString();
const jpFmtPct = (x: number) =>
  isNaN(x) || !isFinite(x) ? '' : (100 * x).toFixed(1) + '%';

const tpl = aggregatorTemplates;

export const jaAggregators: Record<string, any> = {
  '件数': tpl.count(jpFmtInt),
  'ユニーク件数': tpl.countUnique(jpFmtInt),
  '合計': tpl.sum(jpFmt),
  '整数合計': tpl.sum(jpFmtInt),
  '平均': tpl.average(jpFmt),
  '中央値': tpl.median(jpFmt),
  '最小': tpl.min(jpFmt),
  '最大': tpl.max(jpFmt),
  '先頭': tpl.first(jpFmt),
  '末尾': tpl.last(jpFmt),
  '合計の比率(全体)': tpl.fractionOf(tpl.sum(), 'total', jpFmtPct),
  '合計の比率(行)': tpl.fractionOf(tpl.sum(), 'row', jpFmtPct),
  '合計の比率(列)': tpl.fractionOf(tpl.sum(), 'col', jpFmtPct),
  '件数の比率(全体)': tpl.fractionOf(tpl.count(), 'total', jpFmtPct),
  '件数の比率(行)': tpl.fractionOf(tpl.count(), 'row', jpFmtPct),
  '件数の比率(列)': tpl.fractionOf(tpl.count(), 'col', jpFmtPct),
};

export const jaLocaleStrings = {
  renderError: 'ピボットテーブルの描画中にエラーが発生しました。',
  computeError: 'ピボットテーブルの計算中にエラーが発生しました。',
  uiRenderError: 'ピボットテーブルUIの描画中にエラーが発生しました。',
  selectAll: 'すべて選択',
  selectNone: 'すべて解除',
  tooMany: '(項目が多すぎます)',
  filterResults: '絞り込み',
  apply: '適用',
  cancel: 'キャンセル',
  totals: '合計',
  vs: 'vs',
  by: '×',
};

// Transactionフィールドの日本語マッピング
export const FIELD_LABELS: Record<string, string> = {
  '取引日': 'transaction_date',
  'カード会社': 'card_brand',
  '区分': 'transaction_content',
  '金額': 'amount',
  '伝票番号': 'slip_number',
  '支払方法': 'payment_type',
  '端末番号': 'terminal_number',
  '係員': 'clerk',
  'ファイル名': 'file_name',
};
