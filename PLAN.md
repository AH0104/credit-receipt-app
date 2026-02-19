# 実装プラン: 入金消込システム + 各種改善

## 要件サマリー

1. ピボットテーブルに日付フィルタを追加
2. OCR結果の半角/全角統一（カード会社名の正規化）
3. 照合でグループ化した会社をブラインド（折りたたみ）表示
4. 照合で0円グループが残るバグの修正
5. 照合を前半（1日〜15日）/後半（16日〜末日）に分割
6. 入金消込ワークフロー（実入金の記録・差額追跡）
7. イレギュラー支払い（分割2回払い・ボーナス払い等）の追跡
8. 消込記録の保存・履歴表示

## 実務フロー理解

```
売上日          → 入金予定日
─────────────────────────────
1日〜15日       → 当月末日
16日〜末日      → 翌月15日
─────────────────────────────
分割2回払い     → 翌々月（+2ヶ月）
ボーナス払い    → 半年後（+6ヶ月）
```

## Phase 1: バグ修正 + UI改善（既存テーブル変更なし）

### 1-A. OCR結果の正規化 (半角/全角統一)

**ファイル:** `lib/utils/normalize.ts` (新規), `app/api/ocr/route.ts`

正規化ルール:
- 全角英数字 → 半角 (Ａ→A, １→1)
- 全角スペース → 半角スペース
- カード会社名の標準化マッピング:
  - `ＪＣＢ` / `Jcb` → `JCB`
  - `ｖｉｓａ` / `Visa` → `VISA`
  - `ＭＣ` / `マスターカード` / `ﾏｽﾀｰ` → `Mastercard`
  - `アメックス` / `ＡＭＥＸ` → `AMEX`
  - `ダイナース` / `ＤＩＮＥＲＳ` → `Diners`
  - `ｄ払い` → `d払い`  等
- OCR route で parse 後に正規化関数を適用

### 1-B. ピボットテーブル日付フィルタ

**ファイル:** `app/(app)/summary/page.tsx`

- ピボットテーブルの上部に日付範囲セレクタ（年月ピッカー or 開始日〜終了日）を追加
- フィルタ適用後に pivotData を絞り込んでから PivotTableUI に渡す
- 「すべて」ボタンでフィルタ解除

### 1-C. 照合の0円バグ修正

**ファイル:** `app/(app)/reconcile/page.tsx` の `handleCompute`

**原因分析:** `computeActuals` が期間内の取引を集計するが、あるグループのカード会社が全て取消等で0円になった場合、または前回の集計で存在したが今回はない場合でも既存エントリが残る。

**修正:**
- `handleCompute` で集計後、`actual_amount === 0` かつ `expected_amount === 0` のエントリを自動削除またはスキップ
- 既存エントリで actual が 0 になったものは削除（ユーザーが入金額を入力済みの場合は残す）

### 1-D. グループ内ブランドの折りたたみ表示

**ファイル:** `app/(app)/reconcile/page.tsx`, `lib/hooks/use-reconciliation.ts`

- EntryRow に展開/折りたたみボタンを追加
- 展開すると、そのグループに属する個別ブランド別の内訳を表示
- `computeActuals` でブランド別の詳細データも返すように拡張

## Phase 2: 照合の前半/後半分割 + 入金予定日

### 2-A. DBスキーマ変更

**ファイル:** `supabase-migration-v8-payment-tracking.sql` (新規)

```sql
-- reconciliation_periods に期間タイプと入金予定日を追加
ALTER TABLE reconciliation_periods
  ADD COLUMN period_type text DEFAULT 'full_month'
    CHECK (period_type IN ('first_half', 'second_half', 'full_month', 'custom')),
  ADD COLUMN expected_payment_date date;

-- reconciliation_entries に入金実績フィールドを追加
ALTER TABLE reconciliation_entries
  ADD COLUMN payment_received_amount integer DEFAULT 0,
  ADD COLUMN payment_received_date date,
  ADD COLUMN payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'received', 'partial', 'overdue', 'written_off')),
  ADD COLUMN fee_amount integer DEFAULT 0;

-- イレギュラー支払い追跡テーブル（分割・ボーナス等）
CREATE TABLE public.payment_tracking (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  group_label text NOT NULL,
  installment_number integer DEFAULT 1,
  installment_total integer DEFAULT 1,
  payment_type text NOT NULL,          -- '一括', '分割2回', 'ボーナス' 等
  expected_payment_date date NOT NULL,
  expected_amount integer NOT NULL DEFAULT 0,
  actual_amount integer DEFAULT 0,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partial', 'overdue', 'written_off')),
  linked_period_id uuid REFERENCES public.reconciliation_periods(id),
  note text,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.payment_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payment_tracking"
  ON public.payment_tracking FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage payment_tracking"
  ON public.payment_tracking FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin','editor') AND is_active = true)
  );

CREATE TRIGGER set_payment_tracking_updated_at
  BEFORE UPDATE ON public.payment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 2-B. 期間作成UIの変更

**ファイル:** `app/(app)/reconcile/page.tsx`

新規期間ダイアログを変更:
- 年月選択に加えて「前半（1〜15日）」「後半（16〜末日）」のラジオボタン
- 選択に応じて:
  - 前半: period_start=01, period_end=15, expected_payment_date=当月末
  - 後半: period_start=16, period_end=末日, expected_payment_date=翌月15日
- ラベル例: 「2026年2月 前半（1〜15日）入金予定: 2/28」

### 2-C. 型定義の更新

**ファイル:** `lib/types/reconciliation.ts`

```typescript
export interface ReconciliationPeriod {
  // 既存フィールド...
  period_type: 'first_half' | 'second_half' | 'full_month' | 'custom';
  expected_payment_date: string | null;
}

export interface ReconciliationEntry {
  // 既存フィールド...
  payment_received_amount: number;
  payment_received_date: string | null;
  payment_status: 'pending' | 'received' | 'partial' | 'overdue' | 'written_off';
  fee_amount: number;
}

export interface PaymentTracking {
  id: string;
  transaction_id: string;
  group_label: string;
  installment_number: number;
  installment_total: number;
  payment_type: string;
  expected_payment_date: string;
  expected_amount: number;
  actual_amount: number;
  status: 'pending' | 'received' | 'partial' | 'overdue' | 'written_off';
  linked_period_id: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
```

### 2-D. 入金消込ワークフローUI

**ファイル:** `app/(app)/reconcile/page.tsx`, `lib/hooks/use-reconciliation.ts`

照合テーブルの各行に追加:
- 「入金額」→「入金額（実績）」に変更
- 「入金日」入力欄を追加
- 「手数料」入力欄を追加
- ステータスバッジ: 未入金/入金済/一部入金/延滞/貸倒
- 差額 = 売上合計 - 入金実績 - 手数料
- 差額が 0 になったら自動的に「入金済」に

### 2-E. 入金予定日の表示

照合ページのヘッダーに:
- 「入金予定日: YYYY/MM/DD」を表示
- 予定日を過ぎている場合は赤文字で「入金遅延」アラート

## Phase 3: イレギュラー支払い追跡

### 3-A. 分割・ボーナス払い検出

**ファイル:** `lib/utils/payment-schedule.ts` (新規)

```typescript
// 支払方法から入金スケジュールを計算
function computePaymentSchedule(
  transactionDate: string,
  paymentType: string | null,
  amount: number
): PaymentScheduleItem[] {
  // 一括 or null → 標準サイクル（前半/後半ルール）
  // 分割2回 → 2回に分割、翌々月から
  // ボーナス → 半年後に一括
  // リボ → 手動追跡（金額不確定のため）
}
```

### 3-B. 取引保存時に自動で追跡エントリ生成

- insert/update 時に payment_type を見て payment_tracking レコードを自動生成
- 一括払いは payment_tracking を作らず従来通り reconciliation_entries で管理
- 分割・ボーナスのみ payment_tracking で個別追跡

### 3-C. イレギュラー支払いダッシュボード

**ファイル:** `app/(app)/reconcile/page.tsx` に新しいセクション追加

- 未入金のイレギュラー支払い一覧（分割・ボーナス）
- 入金予定日順にソート
- 各エントリに入金記録ボタン
- フィルタ: 全て / 未入金 / 入金済 / 延滞

## Phase 4: 記録・履歴

### 4-A. 消込履歴の永続化

- アーカイブ時に全エントリのスナップショットを保存
- 入金実績・手数料・差額・ステータスを記録として固定

### 4-B. 入金状況サマリービュー

照合ページ上部にサマリーカード:
- 今月の入金予定総額
- 入金済総額
- 未入金残高
- 延滞件数（あれば警告表示）

## 実装順序

| 順番 | タスク | 影響範囲 | DB変更 |
|------|--------|---------|--------|
| 1 | 1-A: OCR正規化 | OCR API + ユーティリティ | なし |
| 2 | 1-B: ピボット日付フィルタ | 集計ページ | なし |
| 3 | 1-C: 0円バグ修正 | 照合ページ | なし |
| 4 | 1-D: グループ折りたたみ | 照合ページ | なし |
| 5 | 2-A: DBマイグレーション | 全体 | v8 SQL |
| 6 | 2-B+C: 前半/後半期間 + 型更新 | 照合ページ + 型定義 | なし |
| 7 | 2-D+E: 入金消込UI | 照合ページ + フック | なし |
| 8 | 3-A+B: イレギュラー追跡 | ユーティリティ + フック | なし |
| 9 | 3-C: イレギュラーダッシュボード | 照合ページ | なし |
| 10 | 4-A+B: 履歴 + サマリー | 照合ページ | なし |

## 変更ファイル一覧

### 新規ファイル
- `lib/utils/normalize.ts` — 半角/全角正規化
- `lib/utils/payment-schedule.ts` — 入金スケジュール計算
- `lib/hooks/use-payment-tracking.ts` — イレギュラー支払い管理フック
- `supabase-migration-v8-payment-tracking.sql` — DBスキーマ変更

### 変更ファイル
- `app/api/ocr/route.ts` — OCR後に正規化適用
- `app/(app)/summary/page.tsx` — 日付フィルタ追加
- `app/(app)/reconcile/page.tsx` — 照合ページ全面改修
- `lib/types/reconciliation.ts` — 型定義拡張
- `lib/hooks/use-reconciliation.ts` — 前半/後半対応 + 入金消込
