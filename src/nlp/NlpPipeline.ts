import { CatalogService } from '../catalog/CatalogService.js';
import { ExtractedItem, ExtractedOrder } from './types.js';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);

interface TokenWithMeta {
  value: string;
  lemma: string;
  pos: string;
  index: number;
}

const UNIT_NORMALIZATION: Record<string, string> = {
  'kg': 'kg',
  'kilo': 'kg',
  'kilos': 'kg',
  'kilogramo': 'kg',
  'kilogramos': 'kg',
  'l': 'l',
  'litro': 'l',
  'litros': 'l',
  'unidad': 'unidad',
  'unidades': 'unidad',
  'pza': 'unidad',
  'pzas': 'unidad',
  'pz': 'unidad',
  'docena': 'docena',
  'docenas': 'docena',
  'und': 'unidad',
  'uds': 'unidad',
  'unit': 'unidad',
  'units': 'unidad',
};

export class NlpPipeline {
  private catalog: CatalogService;
  private intentKeywords: Record<string, string[]> = {
    ADD: ['quiero', 'necesito', 'dame', 'agrega', 'agregar', 'compro', 'comprar', 'añade', 'añadir', 'pido', 'pedir'],
    VIEW: ['carrito', 'ver pedido', 'qué llevo', 'que llevo', 'resumen', 'muestra', 'ver carrito'],
    REMOVE: ['quita', 'quitar', 'elimina', 'eliminar', 'borra', 'borrar', 'saca', 'sacar', 'remueve', 'remover'],
    CHECKOUT: ['confirmar', 'pagar', 'finalizar', 'listo', 'terminar', 'confirmo'],
    CANCEL: ['cancelar', 'olvídalo', 'olvidalo', 'borrar todo', 'cancela', 'anula', 'anular'],
    HELP: ['ayuda', 'cómo', 'comandos', 'ayúdame', 'ayudame'],
  };

  constructor(catalog: CatalogService) {
    this.catalog = catalog;
  }

  async process(text: string): Promise<ExtractedOrder> {
    const doc = nlp.readDoc(text);
    
    // Extract tokens with metadata
    const tokens: TokenWithMeta[] = [];
    doc.tokens().each((t: any) => {
      tokens.push({
        value: t.out(),
        lemma: t.out('lemma'),
        pos: t.out('pos'),
        index: t.index,
      });
    });

    // Classify intent
    const intent = this.classifyIntent(text.toLowerCase());
    
    // Extract items for ADD intent
    const items: ExtractedItem[] = [];
    if (intent === 'ADD') {
      const extractedItems = this.extractItems(tokens, text);
      items.push(...extractedItems);
    }

    return { items, intent, originalText: text };
  }

  private classifyIntent(text: string): ExtractedOrder['intent'] {
    // Check longer phrases first to avoid partial matches like "como" in "como estas"
    const sortedIntents = Object.entries(this.intentKeywords).sort((a, b) => {
      const maxLenA = Math.max(...a[1].map(k => k.length));
      const maxLenB = Math.max(...b[1].map(k => k.length));
      return maxLenB - maxLenA;
    });

    for (const [intent, keywords] of sortedIntents) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return intent as ExtractedOrder['intent'];
        }
      }
    }
    return 'UNKNOWN';
  }

  private normalizeUnit(unit: string): string {
    return UNIT_NORMALIZATION[unit.toLowerCase()] || unit;
  }

  private extractItems(tokens: TokenWithMeta[], originalText: string): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    const lowerText = originalText.toLowerCase();

    // Step 1: Find all quantity matches with positions
    const quantityRegex = /(\d+(?:[.,]\d+)?)\s*((?:kg|kilos?|kilogramos?|l(?:itros?)?|liters?|unidades?|pzas?|pz|docenas?|docena|unds?|uds?|units?))?\b/gi;
    
    const quantityMatches: Array<{quantity: number; unit: string; start: number; end: number}> = [];
    let match;
    while ((match = quantityRegex.exec(lowerText)) !== null) {
      const quantity = parseFloat(match[1].replace(',', '.'));
      const unit = match[2] || '';
      quantityMatches.push({
        quantity,
        unit: this.normalizeUnit(unit),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Step 2: For each quantity, search for products in the following text window
    const usedProductIds = new Set<string>();
    
    for (const q of quantityMatches) {
      // Take a window of text after the quantity, but stop at conjunctions
      let windowText = lowerText.slice(q.end).trim();
      // Stop at common conjunctions/separators
      const separatorMatch = windowText.match(/\s+(?:y|e|,|;|\.)\s+/);
      if (separatorMatch) {
        windowText = windowText.slice(0, separatorMatch.index).trim();
      }
      // Limit window size
      windowText = windowText.slice(0, 30).trim();
      
      if (!windowText) continue;
      
      // Use catalog's fuzzy search
      const searchResults = this.catalog.search(windowText);
      if (searchResults.length === 0) continue;
      
      // Find the best match that hasn't been used yet
      let bestMatch = null;
      for (const result of searchResults) {
        if (!usedProductIds.has(result.product.id) && result.score >= 0.5) {
          bestMatch = result;
          break;
        }
      }
      
      if (bestMatch) {
        usedProductIds.add(bestMatch.product.id);
        
        // Determine the best unit
        const volumeWeightUnits = new Set(['kg', 'l', 'g', 'ml']);
        const finalUnit = (q.unit && volumeWeightUnits.has(q.unit) && bestMatch.product.unit === 'unidad')
          ? bestMatch.product.unit
          : (q.unit || bestMatch.product.unit);
        
        items.push({
          productId: bestMatch.product.id,
          productName: bestMatch.product.name,
          quantity: q.quantity,
          unit: finalUnit,
          confidence: bestMatch.score,
          matchedAlias: bestMatch.matchedAlias,
        });
      }
    }

    // Step 3: If no items found with quantities, try to extract product names from entire text
    if (items.length === 0) {
      const productNames = this.extractProductNames(lowerText);
      for (const productName of productNames) {
        const searchResults = this.catalog.search(productName);
        if (searchResults.length > 0) {
          const bestMatch = searchResults[0];
          if (bestMatch.score >= 0.5 && !usedProductIds.has(bestMatch.product.id)) {
            usedProductIds.add(bestMatch.product.id);
            const product = bestMatch.product;
            items.push({
              productId: product.id,
              productName: product.name,
              quantity: 1,
              unit: product.unit,
              confidence: bestMatch.score,
              matchedAlias: bestMatch.matchedAlias,
            });
          }
        }
      }
    }

    return items;
  }

  private extractProductNames(text: string): string[] {
    const names: string[] = [];
    const allProducts = this.catalog.getAll();
    
    // Sort aliases by length descending to match longer phrases first
    const allAliases: Array<{alias: string; productId: string}> = [];
    for (const product of allProducts) {
      for (const alias of [product.name, ...product.aliases]) {
        allAliases.push({ alias: alias.toLowerCase(), productId: product.id });
      }
    }
    allAliases.sort((a, b) => b.alias.length - a.alias.length);

    const matchedProducts = new Set<string>();
    for (const { alias, productId } of allAliases) {
      if (matchedProducts.has(productId)) continue;
      
      if (text.includes(alias)) {
        names.push(alias);
        matchedProducts.add(productId);
      }
    }
    
    return names;
  }
}