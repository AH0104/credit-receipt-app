import { google } from 'googleapis';

function getAuth() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

// シート初期化（ヘッダー行がなければ作成）
export async function initSheet() {
  const sheets = getSheets();

  // スプレッドシートの情報を取得
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

  // 「取引データ」シートがなければ作成
  if (!sheetNames.includes('取引データ')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: '取引データ' }
          }
        }]
      }
    });
  }

  // ヘッダーを設定（常に最新のヘッダーに更新）
  const expectedHeaders = ['取引日', '伝票番号', '取引内容', '支払区分', '端末番号', 'カード会社', '金額', '係員', '読取確度', '登録日時'];

  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '取引データ!A1:J1',
  }).catch(() => null);

  const currentHeaders = headerCheck?.data?.values?.[0] || [];
  const headersMatch = expectedHeaders.every((h, i) => currentHeaders[i] === h);

  if (!headersMatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '取引データ!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [expectedHeaders]
      }
    });
  }

  return true;
}

// データを追加（複数行）
export async function appendRows(rows: string[][]) {
  const sheets = getSheets();
  await initSheet();

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: '取引データ!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  return result.data.updates?.updatedRows || 0;
}

// 全データを取得
export async function getAllRows() {
  const sheets = getSheets();
  await initSheet();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '取引データ!A:J',
  });

  const rows = result.data.values || [];
  if (rows.length <= 1) return []; // ヘッダーのみ

  return rows.slice(1).map((row, index) => ({
    rowIndex: index + 2, // スプレッドシートの行番号（1-indexed + header）
    transaction_date: row[0] || '',
    card_brand: row[5] || '',
    transaction_type: row[2] || '', // フロントエンド互換（取引内容）
    amount: parseInt(row[6]) || 0,
    slip_number: row[1] || '',
    approval_number: null, // 廃止項目
    confidence: row[8] || '',
    // 追加項目
    payment_type: row[3] || '',
    terminal_number: row[4] || '',
    clerk: row[7] || '',
    created_at: row[9] || '',
  }));
}

// 特定の行を更新
export async function updateRow(rowIndex: number, data: string[]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `取引データ!A${rowIndex}:J${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [data],
    },
  });
  return true;
}

// 特定の行を削除（行をクリア）
export async function deleteRow(rowIndex: number) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `取引データ!A${rowIndex}:J${rowIndex}`,
  });
  return true;
}

// 集計シートを作成・更新
export async function createSummarySheets() {
  const sheets = getSheets();
  await initSheet();

  // スプレッドシートの情報を取得
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

  // 日別集計シートがなければ作成
  if (!sheetNames.includes('日別集計')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: '日別集計' }
          }
        }]
      }
    });
  }

  // 月別集計シートがなければ作成
  if (!sheetNames.includes('月別集計')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: '月別集計' }
          }
        }]
      }
    });
  }

  // 取引データを取得
  const allRows = await getAllRows();

  // 日別集計データを計算
  const dailySummary = calculateDailySummary(allRows);
  // 月別集計データを計算
  const monthlySummary = calculateMonthlySummary(allRows);

  // 日別集計シートを更新
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: '日別集計!A:Z',
  });

  const dailyHeaders = ['日付', 'カード会社', '支払区分', '端末番号', '件数', '合計金額'];
  const dailyValues = [dailyHeaders, ...dailySummary];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '日別集計!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: dailyValues,
    },
  });

  // 月別集計シートを更新
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: '月別集計!A:Z',
  });

  const monthlyHeaders = ['年月', 'カード会社', '支払区分', '端末番号', '件数', '合計金額'];
  const monthlyValues = [monthlyHeaders, ...monthlySummary];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '月別集計!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: monthlyValues,
    },
  });

  return true;
}

// 日別集計を計算
function calculateDailySummary(rows: any[]) {
  const summary: { [key: string]: { count: number; total: number } } = {};

  for (const row of rows) {
    const date = row.transaction_date || '不明';
    const cardBrand = row.card_brand || '不明';
    const paymentType = row.payment_type || '不明';
    const terminalNumber = row.terminal_number || '不明';
    const amount = row.amount || 0;

    const key = `${date}|${cardBrand}|${paymentType}|${terminalNumber}`;

    if (!summary[key]) {
      summary[key] = { count: 0, total: 0 };
    }
    summary[key].count++;
    summary[key].total += amount;
  }

  const result: string[][] = [];
  for (const [key, value] of Object.entries(summary)) {
    const [date, cardBrand, paymentType, terminalNumber] = key.split('|');
    result.push([date, cardBrand, paymentType, terminalNumber, String(value.count), String(value.total)]);
  }

  // 日付でソート
  result.sort((a, b) => a[0].localeCompare(b[0]));

  return result;
}

// 月別集計を計算
function calculateMonthlySummary(rows: any[]) {
  const summary: { [key: string]: { count: number; total: number } } = {};

  for (const row of rows) {
    const date = row.transaction_date || '';
    const yearMonth = date.length >= 7 ? date.substring(0, 7) : '不明';
    const cardBrand = row.card_brand || '不明';
    const paymentType = row.payment_type || '不明';
    const terminalNumber = row.terminal_number || '不明';
    const amount = row.amount || 0;

    const key = `${yearMonth}|${cardBrand}|${paymentType}|${terminalNumber}`;

    if (!summary[key]) {
      summary[key] = { count: 0, total: 0 };
    }
    summary[key].count++;
    summary[key].total += amount;
  }

  const result: string[][] = [];
  for (const [key, value] of Object.entries(summary)) {
    const [yearMonth, cardBrand, paymentType, terminalNumber] = key.split('|');
    result.push([yearMonth, cardBrand, paymentType, terminalNumber, String(value.count), String(value.total)]);
  }

  // 年月でソート
  result.sort((a, b) => a[0].localeCompare(b[0]));

  return result;
}
