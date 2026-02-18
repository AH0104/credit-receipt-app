'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Camera, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/layout/toast-provider';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { useUploadLogs } from '@/lib/hooks/use-upload-logs';
import { useUserProfile } from '@/lib/hooks/use-user-profile';
import { isPdf, fileToBase64, resizeImage } from '@/lib/utils/image-resize';
import { getBrandInfo, formatYen, isCancel, getConfidenceBadge } from '@/lib/constants/card-brands';
import { RoleGuard } from '@/components/auth/role-guard';
import type { PendingRecord } from '@/lib/types/transaction';

interface PendingWithMeta extends PendingRecord {
  _uploadedFileId?: string;
  _rawData?: Record<string, any>;
}

export default function UploadPage() {
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [pendingRecords, setPendingRecords] = useState<PendingWithMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadLogId, setUploadLogId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const { insert } = useTransactions();
  const { createLog, updateLog, uploadFile, saveOcrRaw } = useUploadLogs();
  const { profile } = useUserProfile();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    setPendingRecords([]);
    setUploadLogId(null);

    try {
      // 1. Create upload log
      setProcessStatus('アップロード記録を作成中...');
      const log = await createLog(files.length);
      setUploadLogId(log.id);

      // 2. Upload files to Storage + prepare OCR data
      const images = [];
      const fileIdMap: Record<string, string> = {}; // fileName -> uploadedFile.id

      for (let i = 0; i < files.length; i++) {
        setProcessStatus(`ファイルをアップロード中... ${i + 1}/${files.length}`);

        // Upload to Supabase Storage
        const uploadedFile = await uploadFile(log.id, files[i]);
        fileIdMap[files[i].name] = uploadedFile.id;

        // Prepare base64 for OCR
        if (isPdf(files[i])) {
          const { base64, mimeType } = await fileToBase64(files[i]);
          images.push({ base64, mimeType: mimeType || 'application/pdf', fileName: files[i].name });
        } else {
          const { base64, mimeType } = await resizeImage(files[i]);
          images.push({ base64, mimeType, fileName: files[i].name });
        }
      }

      // 3. Run OCR
      setProcessStatus(`AI読取中... (${images.length}件)`);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();

      if (data.results) {
        const records: PendingWithMeta[] = data.results.map((r: any, i: number) => ({
          temp_id: `pending-${Date.now()}-${i}`,
          ...r,
          _uploadedFileId: fileIdMap[r.file_name] || Object.values(fileIdMap)[0],
          _rawData: { ...r }, // snapshot of OCR raw data
        }));
        setPendingRecords(records);
        await updateLog(log.id, { total_records: data.results.length });
        showToast(`${data.results.length}件を読み取りました`);
      }
    } catch {
      showToast('読取に失敗しました。もう一度お試しください。');
    }

    setProcessing(false);
    setProcessStatus('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    const valid = pendingRecords.filter((r) => !r.error);
    if (valid.length === 0 || !uploadLogId) return;

    setSaving(true);
    try {
      // Insert transactions (with upload_log_id + uploader name)
      const uploaderName = profile?.display_name || profile?.email || '不明';
      const saved = await insert(
        valid.map((r) => ({
          transaction_date: r.transaction_date,
          slip_number: r.slip_number,
          transaction_content: r.transaction_content,
          payment_type: r.payment_type,
          terminal_number: r.terminal_number,
          card_brand: r.card_brand,
          amount: r.amount || 0,
          clerk: r.clerk,
          confidence: r.confidence,
          file_name: r.file_name,
        })),
        uploadLogId,
        uploaderName
      );

      // Save OCR raw results with links to saved transactions
      if (saved) {
        for (let i = 0; i < valid.length; i++) {
          const rec = valid[i];
          const txn = saved[i];
          if (rec._uploadedFileId && rec._rawData && txn) {
            await saveOcrRaw(rec._uploadedFileId, rec._rawData, txn.id);
          }
        }
      }

      // Update log with saved count
      await updateLog(uploadLogId, { saved_records: valid.length });

      showToast(`${valid.length}件を保存しました`);
      setPendingRecords([]);
      setUploadLogId(null);
      router.push('/records');
    } catch {
      showToast('保存に失敗しました');
    }
    setSaving(false);
  };

  const hasResults = pendingRecords.length > 0;
  const validCount = pendingRecords.filter((r) => !r.error).length;

  return (
    <RoleGuard require="canUpload">
    <div className="space-y-5">
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold text-foreground">加盟店控えを読み取り</h1>
        <p className="text-sm text-muted mt-1">写真やPDFをアップロード → AIが自動読取</p>
      </div>

      {/* アップロードエリア */}
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={processing}
          className="w-full bg-card border-2 border-dashed border-border rounded-2xl py-12 px-5 text-center cursor-pointer hover:border-primary hover:bg-primary-light/30 transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          {processing ? (
            <div className="space-y-3">
              <div className="text-4xl animate-pulse">⏳</div>
              <div className="text-sm font-semibold text-primary">{processStatus}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="text-[15px] font-semibold text-foreground">ここをクリックして写真・PDFを選ぶ</div>
              <div className="text-xs text-muted">複数まとめて選択OK（JPEG / PNG / PDF）</div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </button>
      </div>

      {/* 読取結果プレビュー */}
      {hasResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">読み取り結果（{pendingRecords.length}件）</h2>
            {validCount > 0 && (
              <Button onClick={handleSave} disabled={saving} variant="success" className="gap-2">
                {saving ? '保存中...' : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {validCount}件を保存
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">日付</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">カード</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">区分</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted text-xs">金額</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">伝票No</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">信頼度</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted text-xs">ファイル</th>
                </tr>
              </thead>
              <tbody>
                {pendingRecords.map((r) => {
                  const brand = getBrandInfo(r.card_brand);
                  const conf = getConfidenceBadge(r.confidence);
                  const cancel = isCancel(r.transaction_content);
                  return (
                    <tr key={r.temp_id} className={`border-b border-border last:border-b-0 ${r.error ? 'bg-accent-light/30' : ''}`}>
                      <td className="px-3 py-2">{r.transaction_date || '---'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: brand.color }}>
                          {brand.label}
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${cancel ? 'text-accent font-semibold' : ''}`}>
                        {r.transaction_content || '売上'}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${cancel ? 'text-accent' : ''}`}>
                        {cancel ? '−' : ''}{formatYen(r.amount)}
                      </td>
                      <td className="px-3 py-2 text-muted">{r.slip_number || '---'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={conf.variant} className="text-[10px]">{conf.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted text-xs truncate max-w-[120px]">{r.file_name || '---'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 使い方ガイド */}
      {!hasResults && !processing && (
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                使い方
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Camera, title: 'レシートを撮影 / PDFを用意', desc: '加盟店控え（ピンクの紙）をスマホで撮影、またはPDFファイルを用意。' },
                { icon: Upload, title: 'アップロード', desc: '上をクリックして写真またはPDFを選択。まとめて選べます。' },
                { icon: CheckCircle, title: 'AI自動読取 → 確認 → 保存', desc: 'AIが自動で読み取り。確認して「保存」で登録完了。原本ファイルも自動保存されます。' },
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{step.title}</div>
                    <div className="text-xs text-muted mt-0.5">{step.desc}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </RoleGuard>
  );
}
