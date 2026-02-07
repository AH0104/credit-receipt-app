import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json();
    // images: Array<{ base64: string, mimeType: string, fileName: string }>

    if (!images || images.length === 0) {
      return NextResponse.json({ error: '画像がありません' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const results = [];

    for (const image of images) {
      try {
        const prompt = `この画像に含まれる全てのクレジットカード加盟店控え（レシート）を読み取ってください。
複数枚ある場合は全て抽出し、JSON配列で返してください。
JSONのみを返し、マークダウンや説明文は含めないでください。

出力形式（必ず配列で返す）:
[
  {
    "transaction_date": "YYYY-MM-DD",
    "slip_number": "伝票番号",
    "transaction_content": "売上/取消/返品など",
    "payment_type": "一括/分割/リボなど（なければnull）",
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
- payment_type: 支払区分（一括、分割、リボ、ボーナス等）。記載なければnull
- terminal_number: TID、端末ID、端末番号の値
- card_brand: 以下の優先順位で抽出
  1. カード会社欄（JCB, VISA, Mastercard, MUFGカード等）
  2. 決済サービス名（d払い, au PAY, PayPay等）
  3. 上部[]内のテキスト（コード支払い、クレジットカード等）
- amount: 合計金額の数値（取消・返品はマイナス値）
- clerk: 係員欄の手書き名や印鑑（カード名義人ではない）
- confidence: 読み取り確信度

注意:
- カード番号は絶対に抽出しないこと
- 画像内の全てのレシートを漏れなく抽出すること`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          },
        ]);

        const text = result.response.text();
        console.log('Gemini raw response:', text.substring(0, 800)); // デバッグ用

        // JSONを抽出（マークダウンのコードブロックを除去）
        let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        // 配列 [...] またはオブジェクト {...} を検出
        const arrayStart = clean.indexOf('[');
        const objectStart = clean.indexOf('{');

        let jsonStart: number;
        let openChar: string;
        let closeChar: string;

        // 配列が先に出現、またはオブジェクトがない場合は配列として処理
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

        // ネストを追跡して正確に終了位置を特定
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
          // フロントエンドのフィールド名に合わせてマッピング
          results.push({
            transaction_date: item.transaction_date,
            card_brand: item.card_brand,
            transaction_type: item.transaction_content, // フロントエンド互換
            amount: item.amount,
            slip_number: item.slip_number,
            approval_number: null, // 廃止項目
            confidence: item.confidence,
            // 追加項目（スプレッドシート用）
            payment_type: item.payment_type,
            terminal_number: item.terminal_number,
            clerk: item.clerk,
            fileName: image.fileName,
          });
        });
      } catch (err: any) {
        console.error('OCR error for', image.fileName, err);
        results.push({
          transaction_date: null,
          card_brand: null,
          transaction_type: null,
          amount: null,
          slip_number: null,
          approval_number: null,
          confidence: 'low',
          payment_type: null,
          terminal_number: null,
          clerk: null,
          fileName: image.fileName,
          error: true,
          errorMessage: err.message || 'Unknown error', // デバッグ用
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('OCR API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
