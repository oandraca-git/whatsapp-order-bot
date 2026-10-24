import { OrderStore } from '../../src/orders/OrderStore.ts';
import { CartItem } from '../../src/session/types.ts';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_ORDERS_DIR = join(process.cwd(), 'test-orders');
const store = new OrderStore(TEST_ORDERS_DIR);

beforeAll(() => {
  if (existsSync(TEST_ORDERS_DIR)) {
    rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
  }
});

afterAll(() => {
  if (existsSync(TEST_ORDERS_DIR)) {
    rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  if (existsSync(TEST_ORDERS_DIR)) {
    rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
  }
});

describe('OrderStore', () => {
  test('saves order as JSONL line', async () => {
    const items: CartItem[] = [
      { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 },
      { productId: 'PROD-002', name: 'Leche', quantity: 1, unit: 'unidad', unitPrice: 28, subtotal: 28 },
    ];
    const order = await store.save({ userId: 'user1', items, total: 59, status: 'completed' });
    expect(order.id).toBeDefined();
    expect(order.total).toBe(59);
    expect(order.userId).toBe('user1');
    expect(order.items).toHaveLength(2);
    expect(order.status).toBe('completed');
    expect(order.createdAt).toBeInstanceOf(Date);
  });

  test('reads orders for a date', async () => {
    const items: CartItem[] = [
      { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 },
    ];
    await store.save({ userId: 'user1', items, total: 31, status: 'completed' });
    await store.save({ userId: 'user2', items, total: 31, status: 'completed' });
    
    const orders = await store.getByDate(new Date());
    expect(orders.length).toBe(2);
    expect(orders[0].userId).toBe('user1');
    expect(orders[1].userId).toBe('user2');
  });

  test('getByDate returns empty array for date with no orders', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const orders = await store.getByDate(futureDate);
    expect(orders).toHaveLength(0);
  });

  test('getToday returns orders for today', async () => {
    const items: CartItem[] = [
      { productId: 'PROD-001', name: 'Manzana Roja', quantity: 1, unit: 'kg', unitPrice: 15.5, subtotal: 15.5 },
    ];
    await store.save({ userId: 'user3', items, total: 15.5, status: 'completed' });
    const orders = await store.getToday();
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(orders.some(o => o.userId === 'user3')).toBe(true);
  });

  test('orders are saved to YYYY-MM-DD.jsonl file', async () => {
    const items: CartItem[] = [
      { productId: 'PROD-001', name: 'Manzana Roja', quantity: 1, unit: 'kg', unitPrice: 15.5, subtotal: 15.5 },
    ];
    await store.save({ userId: 'user4', items, total: 15.5, status: 'completed' });
    
    const today = new Date().toISOString().split('T')[0];
    const filePath = join(TEST_ORDERS_DIR, `${today}.jsonl`);
    expect(existsSync(filePath)).toBe(true);
  });
});