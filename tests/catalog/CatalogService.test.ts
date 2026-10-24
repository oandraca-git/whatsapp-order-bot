import { CatalogService } from '../../src/catalog/CatalogService.ts';
import { Product, SearchResult } from '../../src/catalog/types.ts';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_CATALOG_PATH = join(process.cwd(), 'test-catalog.json');

const sampleProducts: Product[] = [
  { id: 'P1', name: 'Manzana Roja', aliases: ['manzana', 'manzanas'], price: 15.5, unit: 'kg', stock: 100 },
  { id: 'P2', name: 'Leche Entera 1L', aliases: ['leche', 'leche entera'], price: 28.0, unit: 'unidad', stock: 50 },
  { id: 'P3', name: 'Manzana Verde', aliases: ['manzana verde', 'manzanas verdes'], price: 18.0, unit: 'kg', stock: 80 },
  { id: 'P4', name: 'Pan Integral', aliases: ['pan', 'pan integral'], price: 35.0, unit: 'unidad', stock: 30 },
];

beforeAll(() => {
  writeFileSync(TEST_CATALOG_PATH, JSON.stringify(sampleProducts, null, 2));
});

afterAll(() => {
  if (existsSync(TEST_CATALOG_PATH)) {
    unlinkSync(TEST_CATALOG_PATH);
  }
});

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    service = new CatalogService(TEST_CATALOG_PATH);
    await service.load();
  });

  test('loads products from JSON file', () => {
    const all = service.getAll();
    expect(all).toHaveLength(4);
    expect(all[0].id).toBe('P1');
    expect(all[0].name).toBe('Manzana Roja');
  });

  test('finds product by exact id', () => {
    const p = service.findById('P2');
    expect(p?.name).toBe('Leche Entera 1L');
    expect(p?.price).toBe(28.0);
  });

  test('returns undefined for non-existent id', () => {
    const p = service.findById('NONEXISTENT');
    expect(p).toBeUndefined();
  });

  test('search returns exact match with score 1.0', () => {
    const results = service.search('manzana');
    expect(results.length).toBeGreaterThan(0);
    const exactMatch = results.find(r => r.product.id === 'P1');
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.score).toBe(1.0);
    expect(exactMatch!.matchedAlias).toBe('manzana');
  });

  test('search returns fuzzy matches with score for typos', () => {
    const results = service.search('manzna'); // typo: missing 'a'
    expect(results.length).toBeGreaterThan(0);
    const topMatch = results[0];
    expect(topMatch.product.id).toBe('P1');
    expect(topMatch.score).toBeGreaterThan(0.7);
    expect(topMatch.score).toBeLessThan(1.0);
  });

  test('search returns multiple matches sorted by score descending', () => {
    const results = service.search('manzana');
    // Should match P1 (Manzana Roja) and P3 (Manzana Verde)
    expect(results.length).toBeGreaterThanOrEqual(2);
    const manzanaProducts = results.filter(r => r.product.id === 'P1' || r.product.id === 'P3');
    expect(manzanaProducts.length).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test('search returns empty array for no matches', () => {
    const results = service.search('xyzproductothatexiste');
    expect(results).toHaveLength(0);
  });

  test('reload refreshes catalog from file', async () => {
    const initialCount = service.getAll().length;
    expect(initialCount).toBe(4);
    
    // Add a new product to the file
    const newProducts = [...sampleProducts, { id: 'P5', name: 'Nuevo Producto', aliases: ['nuevo'], price: 10, unit: 'unidad' }];
    writeFileSync(TEST_CATALOG_PATH, JSON.stringify(newProducts, null, 2));
    
    await service.reload();
    expect(service.getAll().length).toBe(5);
    expect(service.findById('P5')?.name).toBe('Nuevo Producto');
  });
});