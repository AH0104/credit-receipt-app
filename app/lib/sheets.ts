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

  // ヘッダーを設定
  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '取引データ!A1:H1',
  }).catch(() => null);

  if (!headerCheck?.data?.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '取引データ!A1:H1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['取引日', 'カード会社', '取扱区分', '取引金額', '伝票番号', '承認番号', '読取確度', '登録日時']]
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
    range: '取引データ!A:H',
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
    range: '取引データ!A:H',
  });

  const rows = result.data.values || [];
  if (rows.length <= 1) return []; // ヘッダーのみ

  return rows.slice(1).map((row, index) => ({
    rowIndex: index + 2, // スプレッドシートの行番号（1-indexed + header）
    transaction_date: row[0] || '',
    card_brand: row[1] || '',
    transaction_type: row[2] || '',
    amount: parseInt(row[3]) || 0,
    slip_number: row[4] || '',
    approval_number: row[5] || '',
    confidence: row[6] || '',
    created_at: row[7] || '',
  }));
}

// 特定の行を更新
export async function updateRow(rowIndex: number, data: string[]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `取引データ!A${rowIndex}:H${rowIndex}`,
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
    range: `取引データ!A${rowIndex}:H${rowIndex}`,
  });
  return true;
}
