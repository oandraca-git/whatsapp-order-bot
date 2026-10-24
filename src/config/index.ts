import { Config } from './schema.js';

export function loadConfig(): Config {
  const sessionTtlMs = process.env.SESSION_TTL_MS ? Number(process.env.SESSION_TTL_MS) : 30 * 60 * 1000;
  const matchAccept = process.env.MATCH_ACCEPT ? Number(process.env.MATCH_ACCEPT) : 0.75;
  const matchClarify = process.env.MATCH_CLARIFY ? Number(process.env.MATCH_CLARIFY) : 0.5;
  
  return {
    catalogPath: process.env.CATALOG_PATH ?? './data/catalog.json',
    ordersDir: process.env.ORDERS_DIR ?? './orders',
    adminNumbers: (process.env.ADMIN_NUMBERS ?? '').split(',').filter(Boolean),
    sessionTtlMs,
    matchingThresholds: {
      accept: matchAccept,
      clarify: matchClarify,
    },
  };
}