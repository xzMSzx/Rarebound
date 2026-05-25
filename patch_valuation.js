import fs from 'fs';

let code = fs.readFileSync('artifacts/msge-lite/data/collectionValuation.js', 'utf8');

code = code.replace(
  "import { lockedCopiesFor, getSlabsForCard } from './agsSubmissionManager.js';",
  "import { lockedCopiesFor, getSlabsForCard, load as loadAgsStore } from './agsSubmissionManager.js';"
);

code = code.replace(
  "  const locked = lockedCopiesFor(setId, cardId);\n  const rawCopies = Math.max(0, count - locked);\n\n  let sum = rawCopies * rawUnit;\n  for (const slab of getSlabsForCard(setId, cardId)) {\n    sum += gradedValueFromRaw(rawUnit, slab.grade);\n  }",
  `  // Cache AGS store on context to avoid O(N) repeated JSON parsing
  if (!ctx._agsStoreCache) {
    ctx._agsStoreCache = loadAgsStore();
  }
  const s = ctx._agsStoreCache;

  let locked = 0;
  for (let i = 0; i < s.active.length; i++) {
    if (s.active[i].setId === setId && s.active[i].cardId === cardId) locked++;
  }
  for (let i = 0; i < s.completed.length; i++) {
    if (s.completed[i].setId === setId && s.completed[i].cardId === cardId) locked++;
  }

  const rawCopies = Math.max(0, count - locked);
  let sum = rawCopies * rawUnit;

  for (let i = 0; i < s.completed.length; i++) {
    const slab = s.completed[i];
    if (slab.setId === setId && slab.cardId === cardId) {
      sum += gradedValueFromRaw(rawUnit, slab.grade);
    }
  }`
);

code = code.replace(
  "    // Clear operation-scoped cache to avoid state desync in tests\n    ctx._apiCardMapCache = undefined;",
  "    // Clear operation-scoped cache to avoid state desync in tests\n    ctx._apiCardMapCache = undefined;\n    ctx._agsStoreCache = undefined;"
);

fs.writeFileSync('artifacts/msge-lite/data/collectionValuation.js', code);

let agsCode = fs.readFileSync('artifacts/msge-lite/data/agsSubmissionManager.js', 'utf8');
agsCode = agsCode.replace("function load() {", "export function load() {");
fs.writeFileSync('artifacts/msge-lite/data/agsSubmissionManager.js', agsCode);
