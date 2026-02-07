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
        const prompt = `このクレジットカード加盟店控え（レシート）の画像から情報を読み取り、JSON形式で返してください。
JSONのみを返し、マークダウンや説明文は含めないでください。

出力形式:
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

抽出ルール:
- transaction_date: ご利用日、取引日などの日付
- slip_number: 伝票番号、伝票No、取引通番、注文番号
- transaction_content: 取引内容（売上、取消、返品、売上訂正など）
- payment_type: 支払区分（一括、分割、リボ、ボーナス等）。記載なければnull
- terminal_number: TID、端末ID、端末番号と記載された番号
- card_brand: 以下の優先順位で抽出
  1. カード会社欄の値（JCB, VISA, Mastercard, MUFGカード等）
  2. 決済サービス名（d払い, au PAY, PayPay等）
  3. 上部[]内のテキスト（クレジットカード、コンタクトレス、コード支払い等）
- amount: 金額（数値のみ、取消・返品はマイナス）
- clerk: 係員欄の手書きサインや印鑑（カード名義人ではない）
- confidence: 読み取り確信度

注意: カード番号は抽出しないこと`;

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
        // JSONを抽出（マークダウンのコードブロックを除去）
        let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        // JSONオブジェクトの開始・終了位置を探す
        const jsonStart = clean.indexOf('{');
        const jsonEnd = clean.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          clean = clean.substring(jsonStart, jsonEnd + 1);
        }
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
