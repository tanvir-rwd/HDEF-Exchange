export interface PaymentMethod {
  id: number;
  name: string;
  number: string;
  instructions: string;
}

export interface User {
  id: number | string;
  name: string; // This is the username, cannot be changed
  email: string;
  password: string;
  wallet_balance: number;
  role: 'user' | 'admin';
  full_name?: string;
  whatsapp_number?: string;
  contact_info?: string;
  profile_details?: string;
  profile_image_url?: string;
  is_verified: boolean;
  verification_code?: string;
  verification_expiry?: number;
  reset_code?: string;
  reset_expiry?: number;
}

export interface Product {
  id: number | string;
  name: string;
  description: string;
  image_urls: string[]; // Changed from image_url: string to image_urls: string[]
  quantity: number;
  quantity_unit: number;
  price: number;
  price_type?: 'BDT' | 'USDT';
  payment_mode?: 'coin' | 'manual';
  discount?: number;
  category: string;
  seller_id?: number | string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Transaction {
  id: number | string;
  user_id: number | string;
  product_id?: number | string;
  amount: number;
  type: 'buy' | 'sell' | 'manual_buy' | 'transfer_in' | 'transfer_out';
  timestamp: string;
  product_name?: string;
  user_name?: string;
  quantity?: number;
  status: 'pending' | 'pending_manual_payment' | 'pending_verification' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  tracking_id: string;
  manual_transaction_id?: string;
  payment_method_id?: number | string;
  payment_screenshot_url?: string;
  recipient_name?: string;
  sender_name?: string;
}
