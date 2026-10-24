import { SessionManager } from '../../src/session/SessionManager.ts';
import { CatalogService } from '../../src/catalog/CatalogService.ts';
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

const catalog = new CatalogService('./data/catalog.json');
await catalog.load();
const sessions = new SessionManager(catalog, { sessionTtlMs: 30 * 60 * 1000 });

describe('SessionManager', () => {
  beforeEach(() => {
    // Clear all sessions
    (sessions as any).sessions.clear();
  });

  afterAll(() => {
    sessions.stop();
  });

  test('creates new session for user', () => {
    const s = sessions.getSession('user1');
    expect(s.userId).toBe('user1');
    expect(s.cart).toHaveLength(0);
    expect(s.state).toBe('idle');
  });

  test('returns existing session for same user', () => {
    const s1 = sessions.getSession('user1');
    s1.cart.push({ productId: 'P1', name: 'Test', quantity: 1, unit: 'unidad', unitPrice: 10, subtotal: 10 });
    const s2 = sessions.getSession('user1');
    expect(s2.cart).toHaveLength(1);
  });

  test('adds item to cart and calculates subtotal', () => {
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 });
    const cart = sessions.getCart('user1');
    expect(cart).toHaveLength(1);
    expect(cart[0].subtotal).toBe(31);
  });

  test('accumulates quantity for same product', () => {
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 1, unit: 'kg', unitPrice: 15.5, subtotal: 15.5 });
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 });
    const cart = sessions.getCart('user1');
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
    expect(cart[0].subtotal).toBe(46.5);
  });

  test('removes item from cart', () => {
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 });
    sessions.addItem('user1', { productId: 'PROD-002', name: 'Leche', quantity: 1, unit: 'unidad', unitPrice: 28, subtotal: 28 });
    sessions.removeItem('user1', 'PROD-001');
    const cart = sessions.getCart('user1');
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe('PROD-002');
  });

  test('clears cart on checkout', () => {
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 });
    sessions.clearCart('user1');
    expect(sessions.getCart('user1')).toHaveLength(0);
  });

  test('handles clarification state', () => {
    sessions.setState('user1', 'awaiting_clarification', {
      candidates: [{ productId: 'PROD-001', name: 'Manzana Roja', score: 0.9 }, { productId: 'PROD-003', name: 'Manzana Verde', score: 0.85 }],
      originalText: 'quiero manzana'
    });
    const s = sessions.getSession('user1');
    expect(s.state).toBe('awaiting_clarification');
    expect(s.pendingClarification?.candidates).toHaveLength(2);
  });

  test('resolves clarification by index', () => {
    sessions.setState('user1', 'awaiting_clarification', {
      candidates: [{ productId: 'PROD-001', name: 'Manzana Roja', score: 0.9 }, { productId: 'PROD-003', name: 'Manzana Verde', score: 0.85 }],
      originalText: 'quiero manzana'
    });
    const resolved = sessions.resolveClarification('user1', 0); // picks first
    expect(resolved.productId).toBe('PROD-001');
    expect(sessions.getSession('user1').state).toBe('idle');
  });

  test('returns null for invalid clarification index', () => {
    sessions.setState('user1', 'awaiting_clarification', {
      candidates: [{ productId: 'PROD-001', name: 'Manzana Roja', score: 0.9 }],
      originalText: 'quiero manzana'
    });
    const resolved = sessions.resolveClarification('user1', 5);
    expect(resolved).toBeNull();
    expect(sessions.getSession('user1').state).toBe('awaiting_clarification');
  });

  test('getCart returns empty array for non-existent user', () => {
    const cart = sessions.getCart('nonexistent');
    expect(cart).toHaveLength(0);
  });

  test('removeItem on non-existent product does nothing', () => {
    sessions.addItem('user1', { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 });
    sessions.removeItem('user1', 'NONEXISTENT');
    const cart = sessions.getCart('user1');
    expect(cart).toHaveLength(1);
  });
});