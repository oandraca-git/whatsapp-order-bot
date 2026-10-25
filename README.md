# WhatsApp Order Bot

Bot de WhatsApp para toma de pedidos usando lenguaje natural. Identifica productos contra un catálogo JSON, mantiene carrito por conversación y genera resumen con total.

## Características

- **WhatsApp**: Baileys (multi-device, gratis)
- **NLP Local**: wink-nlp con modelo español (offline, sin costos)
- **Catálogo**: Archivo JSON editable en caliente
- **Matching**: Exacto + difuso (Levenshtein) con umbrales configurables
- **Persistencia**: Órdenes en JSONL (un archivo por día)
- **Comandos admin**: `/recargar`, `/catalog`, `/ordenes`, `/stats`

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con tus números de admin
npm run dev
```

## Configuración (.env)

```env
CATALOG_PATH=./data/catalog.json
ORDERS_DIR=./orders
ADMIN_NUMBERS=5215512345678,5215587654321
SESSION_TTL_MS=1800000
MATCH_ACCEPT=0.75
MATCH_CLARIFY=0.50
```

## Uso

1. Ejecuta `npm run dev`
2. Escanea el código QR con WhatsApp
3. Escribe pedidos en lenguaje natural:
   - "quiero 2 kilos de manzana y 1 leche"
   - "necesito 3 pan integral"
   - "dame 1 lehe" (manejas typos)
4. "ver carrito" - muestra carrito actual
5. "confirmar" - finaliza pedido
6. "cancelar" - vacía carrito

## Catálogo (data/catalog.json)

```json
[
  {
    "id": "PROD-001",
    "name": "Manzana Roja",
    "aliases": ["manzana", "manzanas", "manzana roja"],
    "price": 15.50,
    "unit": "kg",
    "stock": 100
  }
]
```

## Evaluación NLP

```bash
npm run eval
```

Genera reporte en `eval-report.md` con métricas de precisión/recall/F1.

## Tests

```bash
npm test
```

## Estructura

```
src/
├── index.ts              # Entry point
├── config/               # Configuración
├── catalog/              # Catálogo de productos
├── nlp/                  # Pipeline NLP (wink-nlp)
├── session/              # Gestión de carritos
├── orders/               # Persistencia de órdenes
├── formatter/            # Formateo de respuestas
└── whatsapp/             # Cliente Baileys
```