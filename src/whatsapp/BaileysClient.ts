import { makeWASocket, useMultiFileAuthState, DisconnectReason, WAMessage, proto } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { CatalogService } from '../catalog/CatalogService.js';
import { SessionManager } from '../session/SessionManager.js';
import { NlpPipeline } from '../nlp/NlpPipeline.js';
import { OrderStore } from '../orders/OrderStore.js';
import { ResponseFormatter } from '../formatter/ResponseFormatter.js';
import { Config } from '../config/schema.js';
import { BaileysClientDeps } from './types.js';
import { ExtractedOrder } from '../nlp/types.js';

const logger = pino({ level: 'silent' });

export class BaileysClient {
  private config: Config;
  private catalog: CatalogService;
  private sessions: SessionManager;
  private nlp: NlpPipeline;
  private orders: OrderStore;
  private formatter: ResponseFormatter;
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private isConnectedFlag = false;

  constructor(deps: BaileysClientDeps) {
    this.config = deps.config;
    this.catalog = deps.catalog;
    this.sessions = deps.sessions;
    this.nlp = deps.nlp;
    this.orders = deps.orders;
    this.formatter = deps.formatter;
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
    });

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.isConnectedFlag = false;
        if (shouldReconnect) {
          setTimeout(() => this.start(), 5000);
        }
      } else if (connection === 'open') {
        this.isConnectedFlag = true;
        console.log('WhatsApp conectado');
      }
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        await this.handleMessage(msg);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
      this.isConnectedFlag = false;
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  async simulateMessage(userId: string, text: string): Promise<string | null> {
    if (!this.socket) return null;
    
    // Create a mock message
    const mockMsg: Partial<WAMessage> = {
      key: {
        remoteJid: `${userId}@s.whatsapp.net`,
        fromMe: false,
        id: `test-${Date.now()}`,
      },
      message: {
        conversation: text,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
    };

    await this.handleMessage(mockMsg as WAMessage);
    
    // Get the last sent message (in real implementation, this would be captured)
    // For testing, we'll return a simulated response
    return this.processMessage(userId, text);
  }

  private async handleMessage(msg: WAMessage): Promise<void> {
    if (!this.socket || !msg.message) return;

    const userId = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
    const text = this.extractText(msg.message);
    if (!text) return;

    const response = await this.processMessage(userId, text);
    
    if (response) {
      await this.socket.sendMessage(msg.key.remoteJid!, { text: response });
    }
  }

  private extractText(msg: proto.IMessage): string | null {
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    return null;
  }

  async processMessage(userId: string, text: string): Promise<string | null> {
    const lowerText = text.toLowerCase().trim();
    const session = this.sessions.getSession(userId);

    // Handle clarification state FIRST
    if (session.state === 'awaiting_clarification') {
      const choice = parseInt(text.trim(), 10);
      if (!isNaN(choice)) {
        const resolved = this.sessions.resolveClarification(userId, choice - 1);
        if (resolved) {
          const product = this.catalog.findById(resolved.productId);
          if (product) {
            this.sessions.addItem(userId, {
              productId: product.id,
              name: product.name,
              quantity: 1,
              unit: product.unit,
              unitPrice: product.price,
              subtotal: product.price,
            });
            return this.formatter.formatAdded([{
              productId: product.id,
              productName: product.name,
              quantity: 1,
              unit: product.unit,
              unitPrice: product.price,
              subtotal: product.price,
              confidence: resolved.score,
              matchedAlias: resolved.name,
            }]);
          }
        }
        return this.formatter.formatError('Opción inválida. Intenta de nuevo.');
      }
      return this.formatter.formatError('Por favor responde con un número.');
    }

    // Check admin commands
    if (lowerText.startsWith('/')) {
      if (!this.config.adminNumbers.includes(userId)) {
        return null; // Silently ignore non-admin
      }
      return this.handleAdminCommand(lowerText);
    }

    // Process through NLP
    const extracted = await this.nlp.process(text);

    switch (extracted.intent) {
      case 'ADD':
        return this.handleAddIntent(userId, extracted, session);
      case 'VIEW':
        return this.formatter.formatCart(session);
      case 'REMOVE':
        return this.handleRemoveIntent(userId, extracted, session);
      case 'CHECKOUT':
        return this.handleCheckout(userId, session);
      case 'CANCEL':
        this.sessions.clearCart(userId);
        return '🛒 Tu carrito ha sido vaciado.';
      case 'HELP':
        return this.formatter.formatHelp();
      default:
        return this.formatter.formatError('No entendí tu mensaje. Escribe "ayuda" para ver los comandos.');
    }
  }

  private handleAdminCommand(command: string): string {
    if (command === '/recargar') {
      this.catalog.reload();
      return '✅ Catálogo recargado correctamente.';
    }
    if (command === '/catalog') {
      const products = this.catalog.getAll();
      if (products.length === 0) return '📦 Catálogo vacío.';
      const lines = ['📦 *Catálogo:*'];
      for (const p of products) {
        lines.push(`• ${p.name} - ${this.formatter['formatCurrency'](p.price)}/${p.unit}`);
      }
      return lines.join('\n');
    }
    if (command === '/ordenes') {
      return this.getOrdersSummary();
    }
    if (command === '/stats') {
      return this.getStatsSummary();
    }
    return '❌ Comando no reconocido.';
  }

  private getOrdersSummary(): string {
    // This would be async in real implementation, simplified for testing
    return '📋 Órdenes de hoy: (función simplificada para testing)';
  }

  private getStatsSummary(): string {
    return '📊 Estadísticas del día: (función simplificada para testing)';
  }

  private async handleAddIntent(userId: string, extracted: ExtractedOrder, session: any): Promise<string> {
    if (extracted.items.length === 0) {
      return this.formatter.formatError('No pude identificar productos en tu mensaje.');
    }

    const addedItems = [];
    const clarificationItems = [];

    for (const item of extracted.items) {
      if (item.confidence >= this.config.matchingThresholds.accept) {
        // High confidence - add directly
        const product = this.catalog.findById(item.productId);
        if (product) {
          this.sessions.addItem(userId, {
            productId: product.id,
            name: product.name,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: product.price,
            subtotal: product.price * item.quantity,
          });
          addedItems.push(item);
        }
      } else if (item.confidence >= this.config.matchingThresholds.clarify) {
        // Medium confidence - ask for clarification
        const searchResults = this.catalog.search(item.matchedAlias);
        const candidates = searchResults
          .filter(r => r.score >= this.config.matchingThresholds.clarify)
          .slice(0, 3)
          .map(r => ({ productId: r.product.id, name: r.product.name, score: r.score }));
        
        if (candidates.length > 1) {
          this.sessions.setState(userId, 'awaiting_clarification', {
            candidates,
            originalText: extracted.originalText,
          });
          clarificationItems.push({ item, candidates });
        } else if (candidates.length === 1) {
          const product = this.catalog.findById(candidates[0].productId);
          if (product) {
            this.sessions.addItem(userId, {
              productId: product.id,
              name: product.name,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: product.price,
              subtotal: product.price * item.quantity,
            });
            addedItems.push(item);
          }
        }
      }
    }

    if (clarificationItems.length > 0) {
      return this.formatter.formatClarification(clarificationItems[0].candidates);
    }

    if (addedItems.length > 0) {
      // Create proper items for formatter with calculated subtotals
      const formatterItems = addedItems.map(item => {
        const product = this.catalog.findById(item.productId);
        if (!product) return item;
        return {
          ...item,
          productName: product.name,
          unitPrice: product.price,
          subtotal: product.price * item.quantity,
        };
      });
      return this.formatter.formatAdded(formatterItems);
    }

    return this.formatter.formatError('No pude identificar los productos. Intenta ser más específico.');
  }

  private async handleRemoveIntent(userId: string, extracted: ExtractedOrder, session: any): Promise<string> {
    // Simple removal - find product by name in cart
    const searchResults = this.catalog.search(extracted.originalText);
    if (searchResults.length > 0) {
      const productId = searchResults[0].product.id;
      this.sessions.removeItem(userId, productId);
      return this.formatter.formatRemoved(searchResults[0].product.name);
    }
    return this.formatter.formatError('No encontré ese producto en tu carrito.');
  }

  private async handleCheckout(userId: string, session: any): Promise<string> {
    if (session.cart.length === 0) {
      return '🛒 Tu carrito está vacío.';
    }

    const total = session.cart.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    await this.orders.save({
      userId,
      items: session.cart,
      total,
      status: 'completed',
    });

    const orderSummary = this.formatter.formatOrderSummary({
      id: `ORD-${Date.now()}`,
      userId,
      items: session.cart,
      total,
      createdAt: new Date(),
      status: 'completed',
    });

    this.sessions.clearCart(userId);
    return orderSummary;
  }
}