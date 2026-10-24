export interface MatchingThresholds {
  accept: number;
  clarify: number;
}

export interface Config {
  catalogPath: string;
  ordersDir: string;
  adminNumbers: string[];
  sessionTtlMs: number;
  matchingThresholds: MatchingThresholds;
}