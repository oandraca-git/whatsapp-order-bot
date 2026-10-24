import { Product, SearchResult } from './types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import leven from 'fast-levenshtein';

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function calculateScore(query: string, target: string): number {
  const normQuery = normalize(query);
  const normTarget = normalize(target);
  
  if (normQuery === normTarget) return 1.0;
  
  const distance = leven.get(normQuery, normTarget);
  const maxLen = Math.max(normQuery.length, normTarget.length);
  return 1 - distance / maxLen;
}

export class CatalogService {
  private products: Product[] = [];
  private catalogPath: string;

  constructor(catalogPath: string) {
    this.catalogPath = catalogPath;
  }

  async load(): Promise<void> {
    if (!existsSync(this.catalogPath)) {
      this.products = [];
      return;
    }
    const content = readFileSync(this.catalogPath, 'utf-8');
    this.products = JSON.parse(content);
  }

  getAll(): Product[] {
    return [...this.products];
  }

  findById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  search(query: string): SearchResult[] {
    const productScores = new Map<string, SearchResult>();
    
    for (const product of this.products) {
      const allNames = [product.name, ...product.aliases];
      let bestMatch: SearchResult | null = null;
      
      for (const alias of allNames) {
        const score = calculateScore(query, alias);
        if (score > 0.3) { // minimum threshold
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { product, score, matchedAlias: alias };
          }
        }
      }
      
      if (bestMatch) {
        productScores.set(product.id, bestMatch);
      }
    }
    
    return Array.from(productScores.values()).sort((a, b) => b.score - a.score);
  }

  async reload(): Promise<void> {
    await this.load();
  }
}