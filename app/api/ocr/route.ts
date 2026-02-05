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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const results = [];

    for (const image of images) {
      try {
        const prompt = `このクレジットカード加盟店控え（レシート）の画像から、以下の情報を正確に読み取ってJSON形式で返してください。
JSONのみを返し、他のテキストやマークダウンは一切含めないでください。

{
  "transaction_date": "YYYY-MM-DD形式の取引日",
  "card_brand": "カード会社名（VISA, JCB, Mastercard, AMEX, Diners等）",
  "transaction_type": "売上 or 取消 or 返品",
  "amount": 数値のみ（カンマや¥記号なし）,
  "slip_number": "伝票番号",
  "approval_number": "承認番号",
  "confidence": "high or medium or low（読み取り確信度）"
}

読み取れない項目は null としてください。`;

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
          card_brand: null,
          transaction_type: null,
          amount: null,
          slip_number: null,
          approval_number: null,
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
