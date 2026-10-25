import { loadConfig } from './config/index.js';
import { CatalogService } from './catalog/CatalogService.js';
import { SessionManager } from './session/SessionManager.js';
import { NlpPipeline } from './nlp/NlpPipeline.js';
import { OrderStore } from './orders/OrderStore.js';
import { ResponseFormatter } from './formatter/ResponseFormatter.js';
import { BaileysClient } from './whatsapp/BaileysClient.js';

async function main() {
  const config = loadConfig();
  const catalog = new CatalogService(config.catalogPath);
  await catalog.load();
  const sessions = new SessionManager(catalog, config);
  const nlp = new NlpPipeline(catalog);
  const orders = new OrderStore(config.ordersDir);
  const formatter = new ResponseFormatter();
  const client = new BaileysClient({ config, catalog, sessions, nlp, orders, formatter });
  
  await client.start();
  console.log('Bot iniciado. Escaneá el código QR con WhatsApp.');
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Cerrando...');
    await client.stop();
    sessions.stop();
    process.exit(0);
  });
}

main().catch(console.error);