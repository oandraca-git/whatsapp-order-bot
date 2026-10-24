export interface Product {
  id: string;
  name: string;
  aliases: string[];
  price: number;
  unit: string;
  stock?: number;
}

export interface SearchResult {
  product: Product;
  score: number;
  matchedAlias: string;
}