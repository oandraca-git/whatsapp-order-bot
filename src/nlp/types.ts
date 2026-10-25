export interface ExtractedItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  confidence: number;
  matchedAlias: string;
  unitPrice?: number;
  subtotal?: number;
}

export interface ExtractedOrder {
  items: ExtractedItem[];
  intent: 'ADD' | 'VIEW' | 'REMOVE' | 'CHECKOUT' | 'CANCEL' | 'HELP' | 'UNKNOWN';
  originalText: string;
}