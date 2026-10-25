import { Session } from '../session/types.js';
import { ExtractedItem } from '../nlp/types.js';
import { Order } from '../orders/types.js';

export class ResponseFormatter {
  private currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  formatCart(session: Session): string {
    if (session.cart.length === 0) {
      return '🛒 Tu carrito está vacío.';
    }

    const lines = ['🛒 *Tu carrito:*'];
    for (const item of session.cart) {
      lines.push(`• ${item.quantity} ${item.unit} ${item.name} = ${this.formatCurrency(item.subtotal)}`);
    }
    lines.push(`\n*Total: ${this.formatCurrency(this.calculateTotal(session))}*`);
    lines.push('\n¿Algo más? (escribe "confirmar" para finalizar)');
    return lines.join('\n');
  }

  formatAdded(items: ExtractedItem[]): string {
    if (items.length === 0) return '';
    
    const lines = ['✅ *Agregué al carrito:*'];
    for (const item of items) {
      lines.push(`• ${item.quantity} ${item.unit} ${item.productName} = ${this.formatCurrency(item.subtotal)}`);
    }
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    lines.push(`\n*Total parcial: ${this.formatCurrency(total)}*`);
    lines.push('\n¿Algo más? (escribe "confirmar" para finalizar)');
    return lines.join('\n');
  }

  formatClarification(candidates: Array<{ productId: string; name: string; score: number }>): string {
    const lines = ['❓ *¿Te refieres a:*'];
    candidates.forEach((c, i) => {
      lines.push(`${i + 1}) ${c.name}`);
    });
    lines.push('\nResponde con el número de la opción correcta.');
    return lines.join('\n');
  }

  formatOrderSummary(order: Order): string {
    const lines = [
      '✅ *¡Pedido confirmado!*',
      `\n📦 *Número de pedido:* ${order.id}`,
      '\n📋 *Detalle:*',
    ];
    for (const item of order.items) {
      lines.push(`• ${item.quantity} ${item.unit} ${item.name} = ${this.formatCurrency(item.subtotal)}`);
    }
    lines.push(`\n*Total: ${this.formatCurrency(order.total)}*`);
    lines.push('\n¡Gracias por tu compra! 🎉');
    return lines.join('\n');
  }

  formatHelp(): string {
    return [
      '🤖 *Asistente de pedidos*',
      '\n*Comandos disponibles:*',
      '• Escribe lo que quieres comprar (ej: "quiero 2 kilos de manzana")',
      '• "ver carrito" - Muestra tu carrito actual',
      '• "confirmar" - Finaliza y confirma tu pedido',
      '• "cancelar" - Vacía tu carrito',
      '• "ayuda" - Muestra este mensaje',
      '\n*Para administradores:*',
      '• "/recargar" - Recarga el catálogo',
      '• "/catalog" - Lista productos',
      '• "/ordenes" - Ver órdenes de hoy',
      '• "/stats" - Estadísticas del día',
    ].join('\n');
  }

  formatError(message: string): string {
    return `❌ *Error:* ${message}`;
  }

  formatItemNotFound(query: string, suggestions: string[]): string {
    const lines = [`❌ No encontré "${query}".`];
    if (suggestions.length > 0) {
      lines.push('\n¿Quisiste decir:');
      suggestions.forEach((s, i) => {
        lines.push(`${i + 1}) ${s}`);
      });
    }
    return lines.join('\n');
  }

  formatRemoved(productName: string): string {
    return `🗑️ *${productName}* eliminado del carrito.`;
  }

  private calculateTotal(session: Session): number {
    return session.cart.reduce((sum, item) => sum + item.subtotal, 0);
  }

  private formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }
}