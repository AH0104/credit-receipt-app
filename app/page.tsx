'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ===== Types =====
interface ReceiptRecord {
  id: string;
  rowIndex?: number;
  transaction_date: string | null;
  card_brand: string | null;
  transaction_type: string | null;
  amount: number | null;
  slip_number: string | null;
  approval_number: string | null;
  confidence: string;
  fileName?: string;
  error?: boolean;
  saved?: boolean;
}

// ===== Colors =====
const c = {
  bg: '#F5F3EE',
  card: '#FFFFFF',
  primary: '#1B4965',
  primaryLight: '#E8F0F5',
  accent: '#D4574C',
  accentLight: '#FDF0EE',
  text: '#2C2C2C',
  muted: '#7A7A7A',
  border: '#E5E2DC',
  success: '#2D8659',
  successLight: '#EDF7F1',
  warning: '#C68A1D',
  warningLight: '#FFF8EB',
};

const brandInfo: Record<string, { label: string; color: string }> = {
  JCB: { label: 'JCB', color: '#0066B3' },
  VISA: { label: 'VISA', color: '#1A1F71' },
  Mastercard: { label: 'MC', color: '#EB001B' },
  AMEX: { label: 'AMEX', color: '#006FCF' },
  Diners: { label: 'DC', color: '#006B6F' },
};

function getBrand(name: string | null) {
  if (!name) return { label: '?', color: c.muted };
  const upper = name.toUpperCase();
  if (upper.includes('JCB')) return brandInfo.JCB;
  if (upper.includes('VISA')) return brandInfo.VISA;
  if (upper.includes('MASTER')) return brandInfo.Mastercard;
  if (upper.includes('AMEX')) return brandInfo.AMEX;
  if (upper.includes('DINER')) return brandInfo.Diners;
  return { label: name.slice(0, 4), color: c.muted };
}

function getConfBadge(level: string) {
  if (level === 'high') return { label: '✓ OK', bg: c.successLight, color: c.success };
  if (level === 'medium') return { label: '△ 要確認', bg: c.warningLight, color: c.warning };
  return { label: '✕ 読取不可', bg: c.accentLight, color: c.accent };
}

const yen = (n: number | null) => `¥${(n || 0).toLocaleString()}`;

// ===== Main App =====
export default function CreditReceiptApp() {
  const [view, setView] = useState<'upload' | 'records' | 'summary'>('upload');
  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [savedRecords, setSavedRecords] = useState<ReceiptRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show toast
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load saved data from spreadsheet
  const loadSavedData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sheets');
      const data = await res.json();
      if (data.rows) {
        setSavedRecords(
          data.rows.map((r: any, i: number) => ({
            id: `saved-${i}`,
            rowIndex: r.rowIndex,
            transaction_date: r.transaction_date,
            card_brand: r.card_brand,
            transaction_type: r.transaction_type,
            amount: r.amount,
            slip_number: r.slip_number,
            approval_number: r.approval_number,
            confidence: r.confidence,
            saved: true,
          }))
        );
      }
    } catch (err) {
      console.error(err);
      showToast('データの読み込みに失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ base64: result.split(',')[1], mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Resize image to reduce payload size
  const resizeImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.8): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          let { width, height } = img;

          // Calculate new dimensions
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({
            base64: dataUrl.split(',')[1],
            mimeType: 'image/jpeg',
          });
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Check if file is PDF
  const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  // Handle photo/PDF upload & OCR
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    setView('records');

    const images = [];
    for (let i = 0; i < files.length; i++) {
      setProcessStatus(`ファイルを準備中... ${i + 1}/${files.length}`);
      if (isPdf(files[i])) {
        // PDFはリサイズせずそのままbase64変換
        const { base64, mimeType } = await fileToBase64(files[i]);
        images.push({ base64, mimeType: mimeType || 'application/pdf', fileName: files[i].name });
      } else {
        // 画像をリサイズしてペイロードサイズを削減
        const { base64, mimeType } = await resizeImage(files[i]);
        images.push({ base64, mimeType, fileName: files[i].name });
      }
    }

    setProcessStatus(`AI読取中... (${images.length}件)`);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();

      if (data.results) {
        const newRecords: ReceiptRecord[] = data.results.map((r: any, i: number) => ({
          id: `new-${Date.now()}-${i}`,
          ...r,
          saved: false,
        }));
        setRecords((prev) => [...newRecords, ...prev]);
        showToast(`${data.results.length}件を読み取りました`);
      }
    } catch (err) {
      console.error(err);
      showToast('読取に失敗しました。もう一度お試しください。');
    }

    setProcessing(false);
    setProcessStatus('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // Save unsaved records to spreadsheet
  const saveToSheet = async () => {
    const unsaved = records.filter((r) => !r.saved && !r.error);
    if (unsaved.length === 0) {
      showToast('保存するデータがありません');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: unsaved }),
      });
      const data = await res.json();

      if (data.success) {
        setRecords((prev) => prev.map((r) => ({ ...r, saved: true })));
        showToast(`${unsaved.length}件をスプレッドシートに保存しました`);
        loadSavedData();
      }
    } catch (err) {
      console.error(err);
      showToast('保存に失敗しました');
    }
    setSaving(false);
  };

  // Update record locally
  const updateRecord = (id: string, field: string, value: any) => {
    const update = (list: ReceiptRecord[]) =>
      list.map((r) => (r.id === id ? { ...r, [field]: field === 'amount' ? Number(value) || 0 : value } : r));
    setRecords(update);
    setSavedRecords(update);
  };

  // Delete record
  const deleteRecord = async (record: ReceiptRecord) => {
    if (record.rowIndex) {
      try {
        await fetch('/api/sheets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: record.rowIndex }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    setSavedRecords((prev) => prev.filter((r) => r.id !== record.id));
    setEditingId(null);
    showToast('削除しました');
  };

  // All records combined for display
  const allRecords = [...records, ...savedRecords];
  const unsavedCount = records.filter((r) => !r.saved && !r.error).length;

  const totalAmount = allRecords.reduce((sum, r) => {
    if (!r.amount) return sum;
    const sign = r.transaction_type === '取消' || r.transaction_type === '返品' ? -1 : 1;
    return sum + r.amount * sign;
  }, 0);

  // Summary data
  const getSummary = () => {
    const valid = allRecords.filter((r) => r.transaction_date && r.amount);
    if (summaryMode === 'daily') {
      const grouped: Record<string, { date: string; total: number; count: number; byBrand: Record<string, number> }> = {};
      valid.forEach((r) => {
        const key = r.transaction_date!;
        if (!grouped[key]) grouped[key] = { date: key, total: 0, count: 0, byBrand: {} };
        const sign = r.transaction_type === '取消' || r.transaction_type === '返品' ? -1 : 1;
        grouped[key].total += r.amount! * sign;
        grouped[key].count += 1;
        const brand = r.card_brand || '不明';
        grouped[key].byBrand[brand] = (grouped[key].byBrand[brand] || 0) + r.amount! * sign;
      });
      return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    } else {
      const grouped: Record<string, { brand: string; total: number; count: number }> = {};
      valid
        .filter((r) => r.transaction_date?.startsWith(selectedMonth))
        .forEach((r) => {
          const brand = r.card_brand || '不明';
          if (!grouped[brand]) grouped[brand] = { brand, total: 0, count: 0 };
          const sign = r.transaction_type === '取消' || r.transaction_type === '返品' ? -1 : 1;
          grouped[brand].total += r.amount! * sign;
          grouped[brand].count += 1;
        });
      return Object.values(grouped).sort((a, b) => b.total - a.total);
    }
  };

  // ===== Render helpers =====
  const renderRecordCard = (r: ReceiptRecord) => {
    const brand = getBrand(r.card_brand);
    const conf = getConfBadge(r.confidence);
    const isEditing = editingId === r.id;
    const isCancel = r.transaction_type === '取消' || r.transaction_type === '返品';

    return (
      <div
        key={r.id}
        style={{
          background: c.card,
          borderRadius: 10,
          border: `1px solid ${r.error ? c.accent : !r.saved ? c.primary : c.border}`,
          borderLeft: !r.saved && !r.error ? `3px solid ${c.primary}` : undefined,
          padding: '12px 16px',
        }}
      >
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>取引日</label>
                <input type="date" value={r.transaction_date || ''} onChange={(e) => updateRecord(r.id, 'transaction_date', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>カード会社</label>
                <select value={r.card_brand || ''} onChange={(e) => updateRecord(r.id, 'card_brand', e.target.value)} style={inputStyle}>
                  <option value="">選択</option>
                  <option value="JCB">JCB</option>
                  <option value="VISA">VISA</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="AMEX">AMEX</option>
                  <option value="Diners">Diners</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>区分</label>
                <select value={r.transaction_type || ''} onChange={(e) => updateRecord(r.id, 'transaction_type', e.target.value)} style={inputStyle}>
                  <option value="売上">売上</option>
                  <option value="取消">取消</option>
                  <option value="返品">返品</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>金額</label>
                <input type="number" value={r.amount || ''} onChange={(e) => updateRecord(r.id, 'amount', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>伝票番号</label>
                <input type="text" value={r.slip_number || ''} onChange={(e) => updateRecord(r.id, 'slip_number', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.muted, display: 'block', marginBottom: 3 }}>承認番号</label>
                <input type="text" value={r.approval_number || ''} onChange={(e) => updateRecord(r.id, 'approval_number', e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => deleteRecord(r)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${c.accent}`, background: 'transparent', color: c.accent, fontSize: 12, cursor: 'pointer' }}>削除</button>
              <button onClick={() => setEditingId(null)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: c.primary, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>完了</button>
            </div>
          </div>
        ) : (
          <div onClick={() => setEditingId(r.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 28, borderRadius: 5, background: brand.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{brand.label}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: isCancel ? c.accent : c.text }}>
                  {isCancel ? '−' : ''}{yen(r.amount)}
                </span>
                {isCancel && r.transaction_type && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: c.accentLight, color: c.accent, fontWeight: 600 }}>{r.transaction_type}</span>
                )}
                {!r.saved && !r.error && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: c.primaryLight, color: c.primary, fontWeight: 600 }}>未保存</span>
                )}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: conf.bg, color: conf.color, fontWeight: 600, marginLeft: 'auto' }}>{conf.label}</span>
              </div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>
                {r.transaction_date || '日付不明'} ・ 伝票 {r.slip_number || '---'}
              </div>
            </div>
            <div style={{ color: c.border, fontSize: 18, flexShrink: 0 }}>›</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: c.text, color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: c.primary, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>💳</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>クレジット売上管理</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>MINATO Corporation</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { key: 'upload' as const, icon: '📷', label: '読取' },
            { key: 'records' as const, icon: '📋', label: '一覧' },
            { key: 'summary' as const, icon: '📊', label: '集計' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: view === tab.key ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: view === tab.key ? 600 : 400,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px 100px' }}>
        {/* ===== UPLOAD ===== */}
        {view === 'upload' && (
          <div>
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: 0 }}>加盟店控えを読み取り</h2>
              <p style={{ color: c.muted, fontSize: 13, marginTop: 6 }}>写真やPDFをアップロード → AIが自動読取</p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              style={{ background: c.card, border: `2px dashed ${c.border}`, borderRadius: 16, padding: '44px 20px', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>タップしてファイルを選択</div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>複数まとめて選択OK（JPEG / PNG / PDF）</div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple onChange={handleUpload} style={{ display: 'none' }} />
            </div>

            {processing && (
              <div style={{ background: c.primaryLight, borderRadius: 10, padding: 16, textAlign: 'center', marginTop: 16, fontWeight: 600, color: c.primary, fontSize: 14 }}>
                ⏳ {processStatus}
              </div>
            )}

            <div style={{ background: c.card, borderRadius: 12, padding: 20, border: `1px solid ${c.border}`, marginTop: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, margin: '0 0 14px' }}>📖 使い方</h3>
              {[
                { s: '1', t: 'レシートを撮影 / PDFを用意', d: '加盟店控え（ピンクの紙）をスマホで撮影、またはPDFファイルを用意。' },
                { s: '2', t: 'アップロード', d: '上をタップして写真またはPDFを選択。まとめて選べます。' },
                { s: '3', t: 'AI自動読取', d: '日付・カード会社・金額をAIが読み取ります。' },
                { s: '4', t: '確認 → 保存', d: '一覧で確認・修正して「保存」ボタンでスプレッドシートに反映。' },
              ].map((item) => (
                <div key={item.s} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{item.s}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.text }}>{item.t}</div>
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== RECORDS ===== */}
        {view === 'records' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ background: c.card, borderRadius: 8, padding: '8px 14px', border: `1px solid ${c.border}`, flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: c.muted }}>総件数</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{allRecords.length} 件</div>
              </div>
              <div style={{ background: c.card, borderRadius: 8, padding: '8px 14px', border: `1px solid ${c.border}`, flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: c.muted }}>合計金額</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.primary }}>{yen(totalAmount)}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ flex: 1, padding: '10px', background: c.primaryLight, border: `1px dashed ${c.primary}`, borderRadius: 8, color: c.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                📄 追加読取
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple onChange={handleUpload} style={{ display: 'none' }} />

              {unsavedCount > 0 && (
                <button
                  onClick={saveToSheet}
                  disabled={saving}
                  style={{ flex: 1, padding: '10px', background: c.success, border: 'none', borderRadius: 8, color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '保存中...' : `💾 ${unsavedCount}件を保存`}
                </button>
              )}

              {allRecords.length > 0 && (
                <button
                  onClick={() => {
                    const header = '取引日,カード会社,取扱区分,取引金額,伝票番号,承認番号\n';
                    const rows = allRecords.map((r) => `${r.transaction_date || ''},${r.card_brand || ''},${r.transaction_type || ''},${r.amount || 0},${r.slip_number || ''},${r.approval_number || ''}`).join('\n');
                    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `クレジット売上_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  style={{ padding: '10px 16px', background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  📥 CSV
                </button>
              )}
            </div>

            {processing && (
              <div style={{ background: c.primaryLight, borderRadius: 8, padding: 12, textAlign: 'center', marginBottom: 12, fontWeight: 600, color: c.primary, fontSize: 13 }}>
                ⏳ {processStatus}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: c.muted }}>読み込み中...</div>
            ) : allRecords.length === 0 ? (
              <div style={{ background: c.card, borderRadius: 12, padding: 40, textAlign: 'center', border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ color: c.muted, fontSize: 13 }}>データがありません。「読取」タブから写真をアップロードしてください。</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Unsaved records first */}
                {records.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.primary, padding: '8px 4px 2px' }}>
                      📷 今回読み取った分 ({records.length}件)
                    </div>
                    {records.map(renderRecordCard)}
                  </>
                )}
                {/* Saved records */}
                {savedRecords.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.muted, padding: '12px 4px 2px' }}>
                      ✓ 保存済み ({savedRecords.length}件)
                    </div>
                    {savedRecords.map(renderRecordCard)}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== SUMMARY ===== */}
        {view === 'summary' && (
          <div>
            <div style={{ display: 'flex', background: c.card, borderRadius: 8, padding: 3, border: `1px solid ${c.border}`, marginBottom: 16 }}>
              {[
                { key: 'daily' as const, label: '日別集計' },
                { key: 'monthly' as const, label: '月別（カード会社別）' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSummaryMode(tab.key)}
                  style={{
                    flex: 1,
                    padding: '9px',
                    border: 'none',
                    borderRadius: 6,
                    background: summaryMode === tab.key ? c.primary : 'transparent',
                    color: summaryMode === tab.key ? '#fff' : c.muted,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {summaryMode === 'monthly' && (
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' as const, background: c.card }} />
            )}

            {allRecords.length === 0 ? (
              <div style={{ background: c.card, borderRadius: 12, padding: 40, textAlign: 'center', border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ color: c.muted, fontSize: 13 }}>データがありません</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {getSummary().map((item: any, idx: number) => (
                  <div key={idx} style={{ background: c.card, borderRadius: 10, padding: 14, border: `1px solid ${c.border}` }}>
                    {summaryMode === 'daily' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: c.text }}>{item.date}</div>
                            <div style={{ fontSize: 11, color: c.muted }}>{item.count} 件</div>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: c.primary }}>{yen(item.total)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {Object.entries(item.byBrand).map(([brand, amount]: [string, any]) => {
                            const b = getBrand(brand);
                            return (
                              <div key={brand} style={{ display: 'flex', alignItems: 'center', gap: 5, background: c.bg, borderRadius: 5, padding: '3px 8px' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: b.color }}>{b.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{yen(amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 44, height: 28, borderRadius: 5, background: getBrand(item.brand).color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{getBrand(item.brand).label}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.brand}</div>
                            <div style={{ fontSize: 11, color: c.muted }}>{item.count} 件</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: c.primary }}>{yen(item.total)}</div>
                      </div>
                    )}
                  </div>
                ))}

                {getSummary().length > 0 && (
                  <div style={{ background: c.primary, borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13 }}>合計</span>
                    <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{yen(getSummary().reduce((s: number, i: any) => s + i.total, 0))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Link to spreadsheet */}
            <a
              href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SPREADSHEET_ID || '1RW_lSFCPnqin55nyB3OtCieS-j1kCOc8b_Mj1uNRWbg'}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center', marginTop: 16, padding: '12px', background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, color: c.primary, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
            >
              📊 Googleスプレッドシートを開く →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: `1px solid #E5E2DC`,
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
