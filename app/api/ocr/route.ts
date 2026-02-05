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
  "slip_number": "伝票番号（伝票No、伝票番号と記載されている数字）",
  "transaction_content": "取引内容（売上、取消、返品、売上訂正など）",
  "payment_type": "支払区分（一括、分割、リボ、ボーナス一括、ボーナス2回など）",
  "terminal_number": "端末番号（TID、端末ID、Terminal IDなどと記載されている番号。取扱区分や支払方法とは別の項目）",
  "card_brand": "カード会社名（VISA, JCB, Mastercard, AMEX, Diners, 銀聯等）",
  "amount": 数値のみ（カンマや¥記号なし、取消・返品の場合はマイナス値）,
  "clerk": "係員（手書きのサインや丸印、スタンプで記載されている担当者名。カード名義人とは別。レシート下部に「係員」「担当」などと記載されている欄）",
  "confidence": "high or medium or low（読み取り確信度）"
}

重要な注意事項：
- カード番号は絶対に抽出しないでください（セキュリティ上の理由）
- 端末番号は「TID」「端末ID」などのラベルの横にある番号です。支払区分や取扱区分とは異なります
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
