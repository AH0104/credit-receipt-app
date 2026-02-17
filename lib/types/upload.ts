export interface UploadLog {
  id: string;
  user_id: string;
  file_count: number;
  total_records: number;
  saved_records: number;
  uploaded_at: string;
}

export interface UploadedFile {
  id: string;
  upload_log_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface OcrRawResult {
  id: string;
  uploaded_file_id: string;
  user_id: string;
  transaction_id: string | null;
  raw_data: Record<string, any>;
  created_at: string;
}
