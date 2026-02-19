export interface Transaction {
  id: string;
  user_id: string;
  transaction_date: string | null;
  slip_number: string | null;
  transaction_content: string | null;
  payment_type: string | null;
  terminal_number: string | null;
  card_brand: string | null;
  amount: number;
  installment_count: number;
  clerk: string | null;
  confidence: string;
  file_name: string | null;
  upload_log_id: string | null;
  archived_period_id: string | null;
  // 操作履歴
  uploaded_by_name: string | null;
  uploaded_at: string | null;
  modified_by_name: string | null;
  modified_at: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'modified_by_name' | 'modified_at' | 'confirmed_by_name' | 'confirmed_at'>;

// OCR読み取り直後の未保存レコード（フロント用）
export interface PendingRecord {
  temp_id: string;
  transaction_date: string | null;
  slip_number: string | null;
  transaction_content: string | null;
  payment_type: string | null;
  terminal_number: string | null;
  card_brand: string | null;
  amount: number | null;
  installment_count: number;
  clerk: string | null;
  confidence: string;
  file_name: string | null;
  error?: boolean;
  errorMessage?: string;
}
