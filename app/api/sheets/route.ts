import { NextRequest, NextResponse } from 'next/server';
import { appendRows, getAllRows, updateRow, deleteRow, createSummarySheets } from '@/app/lib/sheets';

// GET: 全データ取得
export async function GET() {
  try {
    const rows = await getAllRows();
    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error('Sheets GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: データ追加
export async function POST(request: NextRequest) {
  try {
    const { records } = await request.json();
    // records: Array<{ transaction_date, slip_number, transaction_content, payment_type, terminal_number, card_brand, amount, clerk, confidence }>

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const rows = records.map((r: any) => [
      r.transaction_date || '',
      r.slip_number || '',
      r.transaction_content || '',
      r.payment_type || '',
      r.terminal_number || '',
      r.card_brand || '',
      String(r.amount || 0),
      r.clerk || '',
      r.confidence || '',
      now,
    ]);

    const count = await appendRows(rows);

    // 集計シートを更新
    await createSummarySheets();

    return NextResponse.json({ success: true, addedRows: count });
  } catch (err: any) {
    console.error('Sheets POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: データ更新
export async function PUT(request: NextRequest) {
  try {
    const { rowIndex, data } = await request.json();
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const row = [
      data.transaction_date || '',
      data.slip_number || '',
      data.transaction_content || '',
      data.payment_type || '',
      data.terminal_number || '',
      data.card_brand || '',
      String(data.amount || 0),
      data.clerk || '',
      data.confidence || '',
      now,
    ];
    await updateRow(rowIndex, row);

    // 集計シートを更新
    await createSummarySheets();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Sheets PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: データ削除
export async function DELETE(request: NextRequest) {
  try {
    const { rowIndex } = await request.json();
    await deleteRow(rowIndex);

    // 集計シートを更新
    await createSummarySheets();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Sheets DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: 集計シートを手動更新
export async function PATCH() {
  try {
    await createSummarySheets();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Sheets PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
