import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createServerClient } from '@supabase/ssr';
import { normalizeOcrResult } from '@/lib/utils/normalize';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { images } = await request.json();
    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // カードブランドマスタを取得してプロンプトに反映
    const { data: brandMaster } = await supabase
      .from('card_brand_master')
      .select('name, aliases')
      .order('sort_order');

    const brandNames = brandMaster?.map((b: { name: string }) => b.name) ?? [];
    const brandList = brandNames.length > 0
      ? brandNames.join(' / ')
      : 'JCB GROUP / MUFGカード / ビザ/マスター / iD / QUIC Pay / 交通IC / Edy / メルペイ / auPAY / dバライ';

    // エイリアス→正規名のマッピングを構築
    const aliasMap = new Map<string, string>();
    for (const b of brandMaster ?? []) {
      const brand = b as { name: string; aliases: string[] };
      aliasMap.set(brand.name.toLowerCase(), brand.name);
      for (const alias of brand.aliases) {
        aliasMap.set(alias.toLowerCase(), brand.name);
      }
    }

    const results = [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    for (const image of images) {
      try {
        const isPdf = image.mimeType === 'application/pdf';
        const prompt = `この${isPdf ? 'PDF' : '画像'}に含まれる全てのクレジットカード加盟店控え（レシート）を読み取ってください。
複数枚ある場合は全て抽出し、JSON配列で返してください。
JSONのみを返し、マークダウンや説明文は含めないでください。

出力形式（必ず配列で返す）:
[
  {
    "transaction_date": "YYYY-MM-DD",
    "slip_number": "伝票番号",
    "transaction_content": "売上/取消/返品など",
    "payment_type": "一括/分割2回/分割3回/リボ/ボーナスなど（なければnull）",
    "installment_count": 1,
    "terminal_number": "端末番号",
    "card_brand": "決済種別",
    "amount": 12345,
    "clerk": "係員名（なければnull）",
    "confidence": "high/medium/low"
  }
]

1枚でも必ず配列で返してください: [{ ... }]

抽出ルール:
- transaction_date: ご利用日、取引日の日付をYYYY-MM-DD形式で
- slip_number: 伝票番号、伝票No、取引通番、注文番号
- transaction_content: 取引内容（売上、取消、返品など）
- payment_type: 支払区分（一括、分割2回、分割3回、リボ、ボーナス等）。
  分割の場合は必ず「分割N回」の形式で回数を含めること。記載なければnull
- installment_count: 分割回数の数値（一括=1、分割2回=2、分割3回=3 等）。
  分割以外またはnullの場合は1
- terminal_number: TID、端末ID、端末番号の値
- card_brand: レシート上のカード会社名・ブランドロゴ・マークから判別し、
  以下のリストから最も近いものを**そのまま**返すこと:
  [${brandList}]
  ※「MUFGカード」「三井住友カード」等の記載があれば、上記リストにある対応する名称を返す
  ※上記リストに該当がなければ「その他」と返す
- amount: 合計金額の数値（取消・返品はマイナス値）
- clerk: 係員欄の手書き名や印鑑（カード名義人ではない）
- confidence: 読み取り確信度

注意:
- カード番号は絶対に抽出しないこと
- ${isPdf ? 'PDF内の全ページを確認し、' : '画像内の'}全てのレシートを漏れなく抽出すること
- 現在は${currentYear}年${currentMonth}月です。年の読み取りには特に注意し、${currentYear - 1}年と誤読しないようにしてください`;

        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { text: prompt },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.base64,
              },
            },
          ],
        });

        const text = result.text || '';

        // JSONを抽出（マークダウンのコードブロックを除去）
        let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const arrayStart = clean.indexOf('[');
        const objectStart = clean.indexOf('{');

        let jsonStart: number;
        let openChar: string;
        let closeChar: string;

        if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
          jsonStart = arrayStart;
          openChar = '[';
          closeChar = ']';
        } else if (objectStart !== -1) {
          jsonStart = objectStart;
          openChar = '{';
          closeChar = '}';
        } else {
          throw new Error('JSON not found in response');
        }

        let nestCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < clean.length; i++) {
          if (clean[i] === openChar) nestCount++;
          if (clean[i] === closeChar) nestCount--;
          if (nestCount === 0) {
            jsonEnd = i;
            break;
          }
        }

        if (jsonEnd === -1) {
          throw new Error('Invalid JSON structure');
        }

        clean = clean.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(clean);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        items.forEach((item: any) => {
          const normalized = normalizeOcrResult(item);
          // マスタのエイリアスで正規名に変換（安全ネット）
          let resolvedBrand = normalized.card_brand;
          if (resolvedBrand && aliasMap.size > 0) {
            const mapped = aliasMap.get(resolvedBrand.toLowerCase());
            if (mapped) {
              resolvedBrand = mapped;
            }
          }
          results.push({
            transaction_date: normalized.transaction_date,
            transaction_content: normalized.transaction_content,
            card_brand: resolvedBrand,
            amount: normalized.amount,
            slip_number: normalized.slip_number,
            confidence: normalized.confidence,
            payment_type: normalized.payment_type,
            installment_count: normalized.installment_count ?? 1,
            terminal_number: normalized.terminal_number,
            clerk: normalized.clerk,
            file_name: image.fileName,
          });
        });
      } catch (err: any) {
        console.error('OCR error for', image.fileName, err);
        results.push({
          transaction_date: null,
          transaction_content: null,
          card_brand: null,
          amount: null,
          slip_number: null,
          confidence: 'low',
          payment_type: null,
          installment_count: 1,
          terminal_number: null,
          clerk: null,
          file_name: image.fileName,
          error: true,
          errorMessage: err.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('OCR API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
