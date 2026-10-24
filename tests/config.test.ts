import { loadConfig } from '../src/config/index.js';
import { Config } from '../src/config/schema.js';

describe('Config Loader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('loads config from env with defaults', () => {
    process.env.CATALOG_PATH = './data/catalog.json';
    process.env.ADMIN_NUMBERS = '5215512345678,5215587654321';
    const cfg = loadConfig();
    expect(cfg.catalogPath).toBe('./data/catalog.json');
    expect(cfg.adminNumbers).toEqual(['5215512345678', '5215587654321']);
    expect(cfg.sessionTtlMs).toBe(30 * 60 * 1000);
    expect(cfg.matchingThresholds.accept).toBe(0.75);
    expect(cfg.matchingThresholds.clarify).toBe(0.5);
  });

  test('uses defaults when env vars not set', () => {
    delete process.env.CATALOG_PATH;
    delete process.env.ADMIN_NUMBERS;
    delete process.env.SESSION_TTL_MS;
    delete process.env.MATCH_ACCEPT;
    delete process.env.MATCH_CLARIFY;
    const cfg = loadConfig();
    expect(cfg.catalogPath).toBe('./data/catalog.json');
    expect(cfg.ordersDir).toBe('./orders');
    expect(cfg.adminNumbers).toEqual([]);
    expect(cfg.sessionTtlMs).toBe(1800000);
    expect(cfg.matchingThresholds.accept).toBe(0.75);
    expect(cfg.matchingThresholds.clarify).toBe(0.5);
  });

  test('parses custom thresholds', () => {
    process.env.MATCH_ACCEPT = '0.8';
    process.env.MATCH_CLARIFY = '0.6';
    const cfg = loadConfig();
    expect(cfg.matchingThresholds.accept).toBe(0.8);
    expect(cfg.matchingThresholds.clarify).toBe(0.6);
  });

  test('filters empty admin numbers', () => {
    process.env.ADMIN_NUMBERS = '5215512345678,,5215587654321,';
    const cfg = loadConfig();
    expect(cfg.adminNumbers).toEqual(['5215512345678', '5215587654321']);
  });
});