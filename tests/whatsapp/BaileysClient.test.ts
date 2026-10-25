import { BaileysClient } from '../../src/whatsapp/BaileysClient.ts';
import { CatalogService } from '../../src/catalog/CatalogService.ts';
import { SessionManager } from '../../src/session/SessionManager.ts';
import { NlpPipeline } from '../../src/nlp/NlpPipeline.ts';
import { OrderStore } from '../../src/orders/OrderStore.ts';
import { ResponseFormatter } from '../../src/formatter/ResponseFormatter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const config = loadConfig();
const TEST_ORDERS_DIR = join(process.cwd(), 'test-orders-whatsapp');

config.ordersDir = TEST_ORDERS_DIR;
config.adminNumbers = ['5215512345678'];

const catalog = new CatalogService(config.catalogPath);
await catalog.load();
const sessions = new SessionManager(catalog, config);
const nlp = new NlpPipeline(catalog);
const orders = new OrderStore(config.ordersDir);
const formatter = new ResponseFormatter();
const client = new BaileysClient({ config, catalog, sessions, nlp, orders, formatter });

beforeAll(async () => {
  if (existsSync(TEST_ORDERS_DIR)) {
    rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
  }
});

afterAll(async () => {
  if (existsSync(TEST_ORDERS_DIR)) {
    rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
  }
  sessions.stop();
});

describe('BaileysClient - Core Logic', () => {
  beforeEach(async () => {
    // Clear sessions and orders
    (sessions as any).sessions.clear();
    if (existsSync(TEST_ORDERS_DIR)) {
      rmSync(TEST_ORDERS_DIR, { recursive: true, force: true });
    }
  });

  test('handles ADD intent message end-to-end', async () => {
    const reply = await client.processMessage('user1', 'quiero 2 manzanas');
    expect(reply).toContain('Agregué al carrito');
    expect(reply).toContain('Manzana Roja');
    expect(reply).toContain('$31.00');
  });

  test('handles multiple items in one message', async () => {
    const reply = await client.processMessage('user2', 'necesito 1 leche y 3 manzanas');
    expect(reply).toContain('Agregué al carrito');
    expect(reply).toContain('Leche');
    expect(reply).toContain('Manzana');
    expect(reply).toContain('$');
  });

  test('handles VIEW_CART intent', async () => {
    await client.processMessage('user3', 'quiero 1 leche');
    const reply = await client.processMessage('user3', 'ver carrito');
    expect(reply).toContain('Leche');
    expect(reply).toContain('Total:');
  });

  test('handles CHECKOUT flow', async () => {
    await client.processMessage('user4', 'quiero 1 manzana');
    const reply = await client.processMessage('user4', 'confirmar');
    expect(reply).toContain('Pedido confirmado');
    expect(reply).toContain('Total:');
    
    // Cart should be cleared after checkout
    const cartReply = await client.processMessage('user4', 'ver carrito');
    expect(cartReply).toContain('vacío');
  });

  test('handles CANCEL flow', async () => {
    await client.processMessage('user5', 'quiero 1 manzana');
    const reply = await client.processMessage('user5', 'cancelar');
    expect(reply).toContain('ha sido vaciado');
  });

  test('handles clarification flow', async () => {
    // Manually set clarification state to test resolution
    sessions.setState('user6', 'awaiting_clarification', {
      candidates: [{ productId: 'PROD-001', name: 'Manzana Roja', score: 0.9 }, { productId: 'PROD-003', name: 'Manzana Verde', score: 0.85 }],
      originalText: 'quiero manzana'
    });
    // Resolve with index
    const reply = await client.processMessage('user6', '1');
    expect(reply).toContain('Agregué al carrito');
  });

  test('handles typo in product name', async () => {
    const reply = await client.processMessage('user7', 'dame 1 lehe');
    expect(reply).toContain('Agregué al carrito');
    expect(reply).toContain('Leche');
  });

  test('ignores admin commands from non-admin', async () => {
    const reply = await client.processMessage('nonadmin', '/recargar');
    expect(reply).toBeNull();
  });

  test('executes /recargar for admin', async () => {
    const reply = await client.processMessage('5215512345678', '/recargar');
    expect(reply).toContain('Catálogo recargado');
  });

  test('executes /catalog for admin', async () => {
    const reply = await client.processMessage('5215512345678', '/catalog');
    expect(reply).toContain('Manzana Roja');
  });

  test('handles REMOVE intent', async () => {
    await client.processMessage('user8', 'quiero 1 manzana');
    const reply = await client.processMessage('user8', 'quita la manzana');
    expect(reply).toContain('eliminado');
  });

  test('handles HELP intent', async () => {
    const reply = await client.processMessage('user9', 'ayuda');
    expect(reply).toContain('Comandos');
    expect(reply).toContain('carrito');
  });
});