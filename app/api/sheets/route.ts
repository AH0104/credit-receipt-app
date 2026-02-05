import { NextRequest, NextResponse } from 'next/server';
import { appendRows, getAllRows, updateRow, deleteRow } from '@/app/lib/sheets';

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
    // records: Array<{ transaction_date, card_brand, transaction_type, amount, slip_number, approval_number, confidence }>

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const rows = records.map((r: any) => [
      r.transaction_date || '',
      r.card_brand || '',
      r.transaction_type || '売上',
      String(r.amount || 0),
      r.slip_number || '',
      r.approval_number || '',
      r.confidence || '',
      now,
    ]);

    const count = await appendRows(rows);
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
      data.card_brand || '',
      data.transaction_type || '売上',
      String(data.amount || 0),
      data.slip_number || '',
      data.approval_number || '',
      data.confidence || '',
      now,
    ];
    await updateRow(rowIndex, row);
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
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Sheets DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
