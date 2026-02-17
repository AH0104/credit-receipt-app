'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UploadLog, UploadedFile, OcrRawResult } from '@/lib/types/upload';

export interface UploadLogWithFiles extends UploadLog {
  uploaded_files: (UploadedFile & { ocr_raw_results: OcrRawResult[] })[];
}

export function useUploadLogs() {
  const supabase = createClient();
  const [logs, setLogs] = useState<UploadLogWithFiles[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('upload_logs')
      .select('*, uploaded_files(*, ocr_raw_results(*))')
      .order('uploaded_at', { ascending: false })
      .limit(50);
    setLogs((data as UploadLogWithFiles[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const createLog = async (fileCount: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const { data, error } = await supabase
      .from('upload_logs')
      .insert({ user_id: user.id, file_count: fileCount, total_records: 0, saved_records: 0 })
      .select()
      .single();
    if (error) throw error;
    return data as UploadLog;
  };

  const updateLog = async (id: string, fields: Partial<UploadLog>) => {
    await supabase.from('upload_logs').update(fields).eq('id', id);
  };

  const uploadFile = async (logId: string, file: File): Promise<UploadedFile> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `${user.id}/${logId}/${crypto.randomUUID()}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('receipts')
      .upload(storagePath, file);
    if (storageErr) throw storageErr;

    const { data, error } = await supabase
      .from('uploaded_files')
      .insert({
        upload_log_id: logId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();
    if (error) throw error;
    return data as UploadedFile;
  };

  const saveOcrRaw = async (uploadedFileId: string, rawData: Record<string, any>, transactionId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証されていません');

    const { error } = await supabase
      .from('ocr_raw_results')
      .insert({
        uploaded_file_id: uploadedFileId,
        user_id: user.id,
        transaction_id: transactionId || null,
        raw_data: rawData,
      });
    if (error) throw error;
  };

  const linkOcrToTransaction = async (ocrRawId: string, transactionId: string) => {
    await supabase
      .from('ocr_raw_results')
      .update({ transaction_id: transactionId })
      .eq('id', ocrRawId);
  };

  return { logs, loading, refetch: fetch, createLog, updateLog, uploadFile, saveOcrRaw, linkOcrToTransaction };
}
