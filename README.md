# クレジット売上管理アプリ

クレジットカード加盟店控えをスマホで撮影 → AIが自動読取 → Googleスプレッドシートに保存・集計

## セットアップ手順

### 1. GitHubにリポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `credit-receipt-app`（何でもOK）
3. Private（非公開）を選択
4. 「Create repository」をクリック

### 2. コードをアップロード

ダウンロードしたフォルダを展開し、ターミナルで以下を実行:

```bash
cd credit-receipt-app
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/credit-receipt-app.git
git push -u origin main
```

### 3. Vercelにデプロイ

1. https://vercel.com/dashboard にアクセス
2. 「Add New → Project」
3. GitHubリポジトリ `credit-receipt-app` をインポート
4. **Environment Variables** に以下を設定:

| 変数名 | 値 |
|---|---|
| `GEMINI_API_KEY` | あなたのGemini APIキー |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | サービスアカウントのJSONファイルの中身をそのまま貼り付け |
| `GOOGLE_SPREADSHEET_ID` | `1RW_lSFCPnqin55nyB3OtCieS-j1kCOc8b_Mj1uNRWbg` |

5. 「Deploy」をクリック

### 4. 完了！

デプロイ完了後に表示されるURL（xxxxx.vercel.app）をスマホのホーム画面に追加すれば、アプリのように使えます。

## 技術スタック

- Next.js 14 (App Router)
- Gemini 2.0 Flash (画像OCR)
- Google Sheets API (データ保存)
- Vercel (ホスティング)
