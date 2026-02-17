export type GroupByColumn =
  | 'transaction_date'
  | 'card_brand'
  | 'payment_type'
  | 'terminal_number'
  | 'transaction_content'
  | 'clerk';

export type AggregationFunction = 'sum' | 'count' | 'avg' | 'max' | 'min';

export interface AggregationSpec {
  field: 'amount';
  function: AggregationFunction;
  label: string;
}

export type DateFilterMode = 'all' | 'month' | 'range';

export interface AggregationPreset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  group_by: GroupByColumn[];
  aggregations: AggregationSpec[];
  date_filter_mode: DateFilterMode;
  sort_column: string;
  sort_direction: 'asc' | 'desc';
  is_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type PresetInsert = Omit<AggregationPreset, 'id' | 'created_at' | 'updated_at'>;

export interface AggregationResult {
  [key: string]: string | number | null;
}

// グループ化軸の日本語ラベル
export const GROUP_BY_OPTIONS: { value: GroupByColumn; label: string }[] = [
  { value: 'transaction_date', label: '取引日' },
  { value: 'card_brand', label: 'カード会社' },
  { value: 'payment_type', label: '支払方法' },
  { value: 'terminal_number', label: '端末番号' },
  { value: 'transaction_content', label: '取引種別' },
  { value: 'clerk', label: '係員' },
];

// 集計関数の日本語ラベル
export const AGGREGATION_FN_OPTIONS: { value: AggregationFunction; label: string }[] = [
  { value: 'sum', label: '合計' },
  { value: 'count', label: '件数' },
  { value: 'avg', label: '平均' },
  { value: 'max', label: '最大' },
  { value: 'min', label: '最小' },
];
