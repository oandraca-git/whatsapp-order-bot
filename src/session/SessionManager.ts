import { CatalogService } from '../catalog/CatalogService.js';
import { Session, CartItem } from './types.js';

interface SessionManagerConfig {
  sessionTtlMs: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private catalog: CatalogService;
  private config: SessionManagerConfig;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(catalog: CatalogService, config: SessionManagerConfig) {
    this.catalog = catalog;
    this.config = config;
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  getSession(userId: string): Session {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        userId,
        cart: [],
        state: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  addItem(userId: string, item: CartItem): void {
    const session = this.getSession(userId);
    const existingIndex = session.cart.findIndex(i => i.productId === item.productId);
    if (existingIndex >= 0) {
      session.cart[existingIndex].quantity += item.quantity;
      session.cart[existingIndex].subtotal = session.cart[existingIndex].quantity * session.cart[existingIndex].unitPrice;
    } else {
      session.cart.push(item);
    }
    session.updatedAt = new Date();
  }

  removeItem(userId: string, productId: string): void {
    const session = this.sessions.get(userId);
    if (!session) return;
    session.cart = session.cart.filter(item => item.productId !== productId);
    session.updatedAt = new Date();
  }

  getCart(userId: string): CartItem[] {
    const session = this.sessions.get(userId);
    return session ? [...session.cart] : [];
  }

  clearCart(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.cart = [];
      session.updatedAt = new Date();
    }
  }

  setState(userId: string, state: Session['state'], pendingClarification?: Session['pendingClarification']): void {
    const session = this.getSession(userId);
    session.state = state;
    session.pendingClarification = pendingClarification;
    session.updatedAt = new Date();
  }

  resolveClarification(userId: string, index: number): { productId: string; name: string; score: number } | null {
    const session = this.sessions.get(userId);
    if (!session || session.state !== 'awaiting_clarification' || !session.pendingClarification) {
      return null;
    }
    const candidate = session.pendingClarification.candidates[index];
    if (!candidate) {
      return null;
    }
    session.state = 'idle';
    session.pendingClarification = undefined;
    session.updatedAt = new Date();
    return candidate;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > this.config.sessionTtlMs) {
        this.sessions.delete(userId);
      }
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}