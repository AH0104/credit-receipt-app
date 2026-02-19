/**
 * 半角/全角正規化 + カード名統一 + 支払区分分類
 */

export type PaymentCategory = '一括' | '2回' | 'その他' | 'ボーナス';

/**
 * 全角英数字→半角、全角スペース→半角スペース
 */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return '';
  return s
    // 全角英数字 → 半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    // 全角スペース → 半角
    .replace(/\u3000/g, ' ')
    // 半角カタカナ → 全角カタカナ
    .replace(/[\uFF65-\uFF9F]/g, (c) => {
      const kanaMap: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ﾝ': 'ン',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー', '･': '・',
      };
      return kanaMap[c] || c;
    })
    .trim();
}

/**
 * カード会社名の正規化マッピング
 */
const CARD_BRAND_ALIASES: [RegExp, string][] = [
  [/^(JCB|ジェイシービー|ジェーシービー)$/i, 'JCB'],
  [/^(VISA|ビザ)$/i, 'VISA'],
  [/^(Mastercard|MC|マスターカード|マスター)$/i, 'Mastercard'],
  [/^(AMEX|アメックス|アメリカンエキスプレス|American\s*Express)$/i, 'AMEX'],
  [/^(Diners|ダイナース|ダイナースクラブ|Diners\s*Club)$/i, 'Diners'],
  [/^(d払い|D払い|d\s*払い)$/, 'd払い'],
  [/^(au\s*PAY|auペイ|aupay)$/i, 'au PAY'],
  [/^(PayPay|ペイペイ)$/i, 'PayPay'],
  [/^(交通系IC|交通系|Suica|PASMO|ICOCA)$/i, '交通系IC'],
  [/^(楽天ペイ|楽天Pay|Rakuten\s*Pay)$/i, '楽天ペイ'],
  [/^(iD|ID)$/, 'iD'],
  [/^(QUICPay|クイックペイ)$/i, 'QUICPay'],
  [/^(UnionPay|銀聯|ユニオンペイ)$/i, 'UnionPay'],
];

/**
 * カード会社名を正規化
 */
export function normalizeCardBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  const normalized = normalizeText(brand);
  for (const [pattern, canonical] of CARD_BRAND_ALIASES) {
    if (pattern.test(normalized)) return canonical;
  }
  return normalized;
}

/**
 * 支払区分の正規化
 * "1回払い" → "一括", "分割2回" → "分割2回", "ボーナス一括" → "ボーナス" 等
 */
export function normalizePaymentType(pt: string | null | undefined): string | null {
  if (!pt) return null;
  const s = normalizeText(pt);
  if (/^(一括|1回|1回払|一回|一回払|1回払い|一括払い?)$/i.test(s)) return '一括';
  if (/ボーナス/i.test(s)) return 'ボーナス';
  if (/リボ/i.test(s)) return 'リボ';
  // "分割N回" 形式はそのまま返す
  const installMatch = s.match(/分割\s*(\d+)\s*回/);
  if (installMatch) return `分割${installMatch[1]}回`;
  // "N回" のみの場合
  const countMatch = s.match(/^(\d+)\s*回/);
  if (countMatch) {
    const n = Number(countMatch[1]);
    if (n === 1) return '一括';
    return `分割${n}回`;
  }
  return s;
}

/**
 * 支払区分 + 分割回数 → PaymentCategory に分類
 */
export function classifyPaymentCategory(
  paymentType: string | null,
  installmentCount: number | null | undefined
): PaymentCategory {
  const pt = paymentType || '';
  const count = installmentCount ?? 1;

  if (/ボーナス/.test(pt)) return 'ボーナス';
  if (count === 2 || /分割2回/.test(pt)) return '2回';
  if (count >= 3 || /リボ/.test(pt) || /分割\d+回/.test(pt)) return 'その他';
  return '一括';
}

/**
 * OCR結果全体を正規化
 */
export function normalizeOcrResult(item: Record<string, any>): Record<string, any> {
  return {
    ...item,
    card_brand: normalizeCardBrand(item.card_brand),
    payment_type: normalizePaymentType(item.payment_type),
    transaction_content: item.transaction_content ? normalizeText(item.transaction_content) : item.transaction_content,
    terminal_number: item.terminal_number ? normalizeText(item.terminal_number) : item.terminal_number,
    slip_number: item.slip_number ? normalizeText(item.slip_number) : item.slip_number,
    clerk: item.clerk ? normalizeText(item.clerk) : item.clerk,
    installment_count: item.installment_count ?? 1,
  };
}
