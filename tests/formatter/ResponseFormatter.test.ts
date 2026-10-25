import { ResponseFormatter } from '../../src/formatter/ResponseFormatter.ts';
import { Session } from '../../src/session/types.ts';
import { ExtractedOrder } from '../../src/nlp/types.ts';
import { Order } from '../../src/orders/types.ts';
import { describe, test, expect } from '@jest/globals';

const formatter = new ResponseFormatter();

describe('ResponseFormatter', () => {
  test('formats cart with running total', () => {
    const session: Session = {
      userId: 'u1', cart: [
        { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 },
        { productId: 'PROD-002', name: 'Leche', quantity: 1, unit: 'unidad', unitPrice: 28, subtotal: 28 },
      ], state: 'idle', createdAt: new Date(), updatedAt: new Date()
    };
    const msg = formatter.formatCart(session);
    expect(msg).toContain('Manzana Roja');
    expect(msg).toContain('2 kg');
    expect(msg).toContain('$31.00');
    expect(msg).toContain('Leche');
    expect(msg).toContain('$28.00');
    expect(msg).toContain('Total: $59.00');
  });

  test('formats empty cart', () => {
    const session: Session = {
      userId: 'u1', cart: [], state: 'idle', createdAt: new Date(), updatedAt: new Date()
    };
    const msg = formatter.formatCart(session);
    expect(msg).toContain('vacío');
  });

  test('formats added items confirmation', () => {
    const items = [{ productId: 'PROD-001', productName: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31, confidence: 0.95, matchedAlias: 'manzana' }];
    const msg = formatter.formatAdded(items);
    expect(msg).toContain('Agregué al carrito');
    expect(msg).toContain('2 kg Manzana Roja');
    expect(msg).toContain('$31.00');
  });

  test('formats clarification prompt', () => {
    const msg = formatter.formatClarification([
      { productId: 'PROD-001', name: 'Manzana Roja', score: 0.9 },
      { productId: 'PROD-003', name: 'Manzana Verde', score: 0.85 },
    ]);
    expect(msg).toContain('¿Te refieres a:');
    expect(msg).toContain('1) Manzana Roja');
    expect(msg).toContain('2) Manzana Verde');
    expect(msg).toContain('Responde con el número');
  });

  test('formats order summary for checkout', () => {
    const order: Order = {
      id: 'ORD-123', userId: 'u1', items: [
        { productId: 'PROD-001', name: 'Manzana Roja', quantity: 2, unit: 'kg', unitPrice: 15.5, subtotal: 31 },
      ], total: 31, createdAt: new Date(), status: 'completed'
    };
    const msg = formatter.formatOrderSummary(order);
    expect(msg).toContain('Pedido confirmado');
    expect(msg).toContain('ORD-123');
    expect(msg).toContain('Total: $31.00');
  });

  test('formats help message', () => {
    const msg = formatter.formatHelp();
    expect(msg).toContain('Comandos');
    expect(msg).toContain('carrito');
    expect(msg).toContain('confirmar');
  });

  test('formats error message', () => {
    const msg = formatter.formatError('Producto no encontrado');
    expect(msg).toContain('Producto no encontrado');
    expect(msg).toContain('❌');
  });

  test('formats item not found message', () => {
    const msg = formatter.formatItemNotFound('xyz', ['Manzana Roja', 'Manzana Verde']);
    expect(msg).toContain('xyz');
    expect(msg).toContain('Manzana Roja');
    expect(msg).toContain('Manzana Verde');
  });

  test('formats remove confirmation', () => {
    const msg = formatter.formatRemoved('Manzana Roja');
    expect(msg).toContain('Manzana Roja');
    expect(msg).toContain('eliminado');
  });
});