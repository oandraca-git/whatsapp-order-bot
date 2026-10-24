import { Order } from './types.js';
import { CartItem } from '../session/types.js';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export class OrderStore {
  private ordersDir: string;

  constructor(ordersDir: string) {
    this.ordersDir = ordersDir;
    if (!existsSync(this.ordersDir)) {
      mkdirSync(this.ordersDir, { recursive: true });
    }
  }

  async save(orderData: { userId: string; items: CartItem[]; total: number; status: 'completed' | 'cancelled' }): Promise<Order> {
    const order: Order = {
      id: uuidv4(),
      userId: orderData.userId,
      items: orderData.items,
      total: orderData.total,
      createdAt: new Date(),
      status: orderData.status,
    };

    // Ensure directory exists
    if (!existsSync(this.ordersDir)) {
      mkdirSync(this.ordersDir, { recursive: true });
    }

    const dateStr = order.createdAt.toISOString().split('T')[0];
    const filePath = join(this.ordersDir, `${dateStr}.jsonl`);
    appendFileSync(filePath, JSON.stringify(order) + '\n');
    
    return order;
  }

  async getByDate(date: Date): Promise<Order[]> {
    const dateStr = date.toISOString().split('T')[0];
    const filePath = join(this.ordersDir, `${dateStr}.jsonl`);
    
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    return lines.map(line => JSON.parse(line));
  }

  async getToday(): Promise<Order[]> {
    return this.getByDate(new Date());
  }
}