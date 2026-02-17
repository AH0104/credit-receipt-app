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
  clerk: string | null;
  confidence: string;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;

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
  clerk: string | null;
  confidence: string;
  file_name: string | null;
  error?: boolean;
  errorMessage?: string;
}
