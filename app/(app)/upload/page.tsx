'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Camera, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/layout/toast-provider';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { isPdf, fileToBase64, resizeImage } from '@/lib/utils/image-resize';
import { getBrandInfo, formatYen, isCancel, getConfidenceBadge } from '@/lib/constants/card-brands';
import type { PendingRecord } from '@/lib/types/transaction';

export default function UploadPage() {
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const { insert } = useTransactions();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);
    setPendingRecords([]);

    const images = [];
    for (let i = 0; i < files.length; i++) {
      setProcessStatus(`ファイルを準備中... ${i + 1}/${files.length}`);
      if (isPdf(files[i])) {
        const { base64, mimeType } = await fileToBase64(files[i]);
        images.push({ base64, mimeType: mimeType || 'application/pdf', fileName: files[i].name });
      } else {
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
        const records: PendingRecord[] = data.results.map((r: any, i: number) => ({
          temp_id: `pending-${Date.now()}-${i}`,
          ...r,
        }));
        setPendingRecords(records);
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
    if (valid.length === 0) return;

    setSaving(true);
    try {
      await insert(valid.map((r) => ({
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
      })));
      showToast(`${valid.length}件を保存しました`);
      setPendingRecords([]);
      router.push('/records');
    } catch {
      showToast('保存に失敗しました');
    }
    setSaving(false);
  };

  const hasResults = pendingRecords.length > 0;
  const validCount = pendingRecords.filter((r) => !r.error).length;

  return (
    <div className="space-y-5">
      {/* タイトル */}
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold text-foreground">加盟店控えを読み取り</h1>
        <p className="text-sm text-muted mt-1">写真やPDFをアップロード → AIが自動読取</p>
      </div>

      {/* アップロードエリア */}
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
            <div className="text-[15px] font-semibold text-foreground">ここをタップして写真・PDFを選ぶ</div>
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

      {/* 読取結果プレビュー */}
      {hasResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">読み取り結果（{pendingRecords.length}件）</h2>
            {validCount > 0 && (
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="success"
                size="default"
                className="gap-2"
              >
                {saving ? '保存中...' : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {validCount}件を保存
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {pendingRecords.map((r) => {
              const brand = getBrandInfo(r.card_brand);
              const conf = getConfidenceBadge(r.confidence);
              const cancel = isCancel(r.transaction_content);

              return (
                <Card key={r.temp_id} className={r.error ? 'border-accent' : 'border-primary/30'}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: brand.color }}
                      >
                        {brand.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[15px] font-bold ${cancel ? 'text-accent' : 'text-foreground'}`}>
                            {cancel ? '−' : ''}{formatYen(r.amount)}
                          </span>
                          <Badge variant={conf.variant} className="text-[10px]">
                            {conf.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {r.transaction_date || '日付不明'} ・ {r.transaction_content || '売上'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 使い方ガイド（結果がない時のみ表示） */}
      {!hasResults && !processing && (
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
              { icon: Upload, title: 'アップロード', desc: '上をタップして写真またはPDFを選択。まとめて選べます。' },
              { icon: CheckCircle, title: 'AI自動読取 → 確認 → 保存', desc: 'AIが自動で読み取り。確認して「保存」で登録完了。' },
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
      )}
    </div>
  );
}
