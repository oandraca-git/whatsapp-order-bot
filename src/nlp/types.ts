export interface ExtractedItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  confidence: number;
  matchedAlias: string;
}

export interface ExtractedOrder {
  items: ExtractedItem[];
  intent: 'ADD' | 'VIEW' | 'REMOVE' | 'CHECKOUT' | 'CANCEL' | 'HELP' | 'UNKNOWN';
  originalText: string;
}