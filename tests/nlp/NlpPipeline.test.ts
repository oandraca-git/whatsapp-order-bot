import { NlpPipeline } from '../../src/nlp/NlpPipeline.ts';
import { CatalogService } from '../../src/catalog/CatalogService.ts';
import { describe, test, expect, beforeAll } from '@jest/globals';

const catalog = new CatalogService('./data/catalog.json');
await catalog.load();
const nlp = new NlpPipeline(catalog);

describe('NlpPipeline', () => {
  test('extracts quantity + product from simple sentence', async () => {
    const result = await nlp.process('quiero 2 kilos de manzana');
    expect(result.intent).toBe('ADD');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].unit).toBe('kg');
    expect(result.items[0].productId).toBe('PROD-001');
  });

  test('extracts multiple items in one message', async () => {
    const result = await nlp.process('necesito 1 leche y 3 manzanas');
    expect(result.intent).toBe('ADD');
    expect(result.items).toHaveLength(2);
    const quantities = result.items.map(i => i.quantity).sort();
    expect(quantities).toEqual([1, 3]);
    const productIds = result.items.map(i => i.productId).sort();
    expect(productIds).toEqual(['PROD-001', 'PROD-002']);
  });

  test('handles typos in product name', async () => {
    const result = await nlp.process('dame 1 lehe'); // typo: leche
    expect(result.intent).toBe('ADD');
    expect(result.items[0].productId).toBe('PROD-002');
    expect(result.items[0].confidence).toBeGreaterThan(0.7);
  });

  test('detects VIEW_CART intent', async () => {
    const result = await nlp.process('ver carrito');
    expect(result.intent).toBe('VIEW');
    expect(result.items).toHaveLength(0);
  });

  test('detects CHECKOUT intent', async () => {
    const result = await nlp.process('confirmar pedido');
    expect(result.intent).toBe('CHECKOUT');
  });

  test('detects CANCEL intent', async () => {
    const result = await nlp.process('cancelar todo');
    expect(result.intent).toBe('CANCEL');
  });

  test('detects REMOVE intent', async () => {
    const result = await nlp.process('quita la manzana');
    expect(result.intent).toBe('REMOVE');
  });

  test('detects HELP intent', async () => {
    const result = await nlp.process('ayuda');
    expect(result.intent).toBe('HELP');
  });

  test('defaults unit when not specified', async () => {
    const result = await nlp.process('quiero 5 manzanas'); // no "kilos"
    expect(result.items[0].unit).toBe('kg'); // product's base unit
  });

  test('handles quantity with unit variations', async () => {
    const result = await nlp.process('quiero 2 litros de leche');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].unit).toBe('unidad'); // leche is per unidad
  });

  test('returns UNKNOWN for unrecognized input', async () => {
    const result = await nlp.process('hola como estas');
    expect(result.intent).toBe('UNKNOWN');
  });
});