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
        const prompt = `このクレジットカード加盟店控え（レシート）の画像から、以下の情報を正確に読み取ってJSON形式で返してください。
JSONのみを返し、他のテキストやマークダウンは一切含めないでください。

{
  "transaction_date": "YYYY-MM-DD形式の取引日",
  "slip_number": "伝票番号（伝票No、伝票番号、取引通番、注文番号と記載されている数字）",
  "transaction_content": "取引内容（売上、取消、返品、売上訂正など）",
  "payment_type": "支払区分（一括、分割、リボ、ボーナス一括、ボーナス2回など。記載がなければnull）",
  "terminal_number": "端末番号（TID、端末ID、端末番号などと記載されている番号）",
  "card_brand": "決済種別（下記の優先順位で抽出）",
  "amount": 数値のみ（カンマや¥記号なし、取消・返品の場合はマイナス値）,
  "clerk": "係員（手書きのサインや丸印、スタンプで記載されている担当者名。カード名義人とは別）",
  "confidence": "high or medium or low（読み取り確信度）"
}

【card_brand（決済種別）の抽出ルール - 優先順位順】
1. 「カード会社」「カード名」欄に記載がある場合 → その値を使用（例: JCB, VISA, Mastercard, AMEX, Diners, MUFGカード等）
2. 金額の近くに決済サービス名がある場合 → その値を使用（例: d払い, au PAY, PayPay, 楽天ペイ等）
3. 上記がない場合 → レシート上部の[]（角括弧）内のテキストから種別を抽出
   - [クレジットカード売上票] → 「クレジットカード」
   - [コンタクトレス売上票] → 「コンタクトレス」
   - [コード支払い取扱票] → 「コード支払い」
   - [デビットカード売上票] → 「デビットカード」

重要な注意事項：
- カード番号は絶対に抽出しないでください（セキュリティ上の理由）
- 係員はカード名義人（お客様の名前）ではありません。店舗スタッフの名前や印鑑です
- 読み取れない項目は null としてください
- 取消や返品の場合、金額はマイナス値で返してください`;

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
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        items.forEach((item: any) => {
          results.push({
            ...item,
            fileName: image.fileName,
          });
        });
      } catch (err: any) {
        console.error('OCR error for', image.fileName, err);
        results.push({
          transaction_date: null,
          slip_number: null,
          transaction_content: null,
          payment_type: null,
          terminal_number: null,
          card_brand: null,
          amount: null,
          clerk: null,
          confidence: 'low',
          fileName: image.fileName,
          error: err.message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('OCR API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
