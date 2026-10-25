import { NlpPipeline } from '../src/nlp/NlpPipeline.js';
import { CatalogService } from '../src/catalog/CatalogService.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface EvaluationCase {
  input: string;
  expectedIntent: string;
  expectedItems: Array<{ productId: string; quantity: number; unit?: string }>;
}

interface EvaluationResult {
  case: EvaluationCase;
  predicted: { intent: string; items: Array<{ productId: string; quantity: number; unit: string; confidence: number }> };
  intentCorrect: boolean;
  itemsPrecision: number;
  itemsRecall: number;
  itemsF1: number;
}

async function main() {
  console.log('🔍 Iniciando evaluación NLP...\n');
  
  const catalog = new CatalogService('./data/catalog.json');
  await catalog.load();
  const nlp = new NlpPipeline(catalog);
  
  const cases: EvaluationCase[] = JSON.parse(
    readFileSync(join(process.cwd(), 'tests/fixtures/evaluation-cases.json'), 'utf-8')
  );
  
  const results: EvaluationResult[] = [];
  
  for (const case_ of cases) {
    const predicted = await nlp.process(case_.input);
    
    // Intent accuracy
    const intentCorrect = predicted.intent === case_.expectedIntent;
    
    // Item extraction metrics
    const expectedItems = case_.expectedItems;
    const predictedItems = predicted.items;
    
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    // Match predicted items to expected items
    const matchedExpected = new Set<number>();
    
    for (const pred of predictedItems) {
      let matched = false;
      for (let i = 0; i < expectedItems.length; i++) {
        if (matchedExpected.has(i)) continue;
        const exp = expectedItems[i];
        // Match by productId and quantity (within ±1)
        if (pred.productId === exp.productId && Math.abs(pred.quantity - exp.quantity) <= 1) {
          truePositives++;
          matchedExpected.add(i);
          matched = true;
          break;
        }
      }
      if (!matched) falsePositives++;
    }
    
    falseNegatives = expectedItems.length - matchedExpected.size;
    
    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 1;
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 1;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 1;
    
    results.push({
      case: case_,
      predicted: { intent: predicted.intent, items: predicted.items },
      intentCorrect,
      itemsPrecision: precision,
      itemsRecall: recall,
      itemsF1: f1,
    });
  }
  
  // Aggregate metrics
  const totalCases = results.length;
  const intentAccuracy = results.filter(r => r.intentCorrect).length / totalCases;
  const avgPrecision = results.reduce((sum, r) => sum + r.itemsPrecision, 0) / totalCases;
  const avgRecall = results.reduce((sum, r) => sum + r.itemsRecall, 0) / totalCases;
  const avgF1 = results.reduce((sum, r) => sum + r.itemsF1, 0) / totalCases;
  const avgConfidence = results.reduce((sum, r) => {
    const confs = r.predicted.items.map(i => i.confidence);
    return sum + (confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : 0);
  }, 0) / totalCases;
  
  // Confusion matrix for intents
  const intents = ['ADD', 'VIEW', 'REMOVE', 'CHECKOUT', 'CANCEL', 'HELP', 'UNKNOWN'];
  const confusionMatrix: Record<string, Record<string, number>> = {};
  for (const actual of intents) {
    confusionMatrix[actual] = {};
    for (const pred of intents) {
      confusionMatrix[actual][pred] = 0;
    }
  }
  
  for (const r of results) {
    confusionMatrix[r.case.expectedIntent][r.predicted.intent]++;
  }
  
  // Generate report
  const report = `
# NLP Evaluation Report

## Summary
- **Total test cases**: ${totalCases}
- **Intent Accuracy**: ${(intentAccuracy * 100).toFixed(1)}%
- **Item Extraction Precision**: ${(avgPrecision * 100).toFixed(1)}%
- **Item Extraction Recall**: ${(avgRecall * 100).toFixed(1)}%
- **Item Extraction F1**: ${(avgF1 * 100).toFixed(1)}%
- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%

## Confusion Matrix (Intent Classification)
| Actual \\ Predicted | ${intents.join(' | ')} |
|---|${intents.map(() => '---').join('|')}|`;

  const matrixRows = intents.map(actual => {
    const row = intents.map(pred => confusionMatrix[actual][pred]).join(' | ');
    return `| ${actual} | ${row} |`;
  }).join('\n');
  
  const details = results.map((r, i) => `
### Case ${i + 1}: "${r.case.input}"
- **Expected Intent**: ${r.case.expectedIntent}
- **Predicted Intent**: ${r.predicted.intent} ${r.intentCorrect ? '✅' : '❌'}
- **Expected Items**: ${JSON.stringify(r.case.expectedItems)}
- **Predicted Items**: ${JSON.stringify(r.predicted.items.map(p => ({ productId: p.productId, quantity: p.quantity, unit: p.unit, confidence: p.confidence.toFixed(2) })))}
- **Precision**: ${(r.itemsPrecision * 100).toFixed(1)}%
- **Recall**: ${(r.itemsRecall * 100).toFixed(1)}%
- **F1**: ${(r.itemsF1 * 100).toFixed(1)}%
`).join('\n');
  
  const fullReport = report + '\n' + matrixRows + '\n\n---\n\n## Detailed Results\n' + details;
  
  writeFileSync('eval-report.md', fullReport);
  console.log(fullReport);
  console.log('\n✅ Reporte guardado en eval-report.md');
}

main().catch(console.error);