import { CartItem } from '../session/types.js';

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  status: 'completed' | 'cancelled';
}