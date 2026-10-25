import { CatalogService } from '../catalog/CatalogService.js';
import { SessionManager } from '../session/SessionManager.js';
import { NlpPipeline } from '../nlp/NlpPipeline.js';
import { OrderStore } from '../orders/OrderStore.js';
import { ResponseFormatter } from '../formatter/ResponseFormatter.js';
import { Config } from '../config/schema.js';

export interface BaileysClientDeps {
  config: Config;
  catalog: CatalogService;
  sessions: SessionManager;
  nlp: NlpPipeline;
  orders: OrderStore;
  formatter: ResponseFormatter;
}