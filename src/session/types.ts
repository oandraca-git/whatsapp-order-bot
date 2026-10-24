export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface Session {
  userId: string;
  cart: CartItem[];
  state: 'idle' | 'awaiting_clarification' | 'awaiting_checkout';
  pendingClarification?: {
    candidates: Array<{ productId: string; name: string; score: number }>;
    originalText: string;
  };
  createdAt: Date;
  updatedAt: Date;
}