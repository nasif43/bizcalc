import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please connect to Supabase first.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-application-name': 'business-calculator',
    },
  },
});

export type Contact = {
  id: string;
  name: string;
  phone: string;
  nid?: string;
  type: 'customer' | 'supplier';
  created_at: string;
};

export type Transaction = {
  id: string;
  type: 'inflow' | 'outflow';
  amount: number;
  paid_amount: number;
  due_amount: number;
  contact_id: string;
  created_at: string;
  image_url?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  reorder_level: number;
  category?: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
};

export type InventoryTransaction = {
  id: string;
  item_id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  transaction_type: 'initial' | 'restock' | 'adjustment' | 'sale';
  notes?: string;
  created_at: string;
};

export type InventoryItemWithTransactions = InventoryItem & {
  transactions: InventoryTransaction[];
};