const fs = require('fs');

const file = 'artifacts/msge-lite/data/museumManager.js';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
  "import { getCollection, decrementCard } from './collectionManager.js';",
  "import { getCollection, decrementCard, runWithCollectionCache } from './collectionManager.js';"
);

content = content.replace(
  "import { getCachedSetCards } from './cardPoolManager.js';",
  "import { getCachedSetCards, getCachedSetCardsMap } from './cardPoolManager.js';"
);

// Update matchesMuseumCriteria
content = content.replace(
  "export function matchesMuseumCriteria(setId, cardId, criteria) {\n  if (criteria.kind === 'set') return criteria.setIds.includes(setId);\n  \n  const cached = getCachedSetCards(setId) || [];\n  const apiCard = cached.find(c => c.id === cardId);",
  "export function matchesMuseumCriteria(setId, cardId, criteria, setMap = null) {\n  if (criteria.kind === 'set') return criteria.setIds.includes(setId);\n  \n  const apiCard = setMap ? setMap.get(cardId) : (getCachedSetCards(setId) || []).find(c => c.id === cardId);"
);

// Update getEligibleMuseumCards
const oldEligible = `export function getEligibleMuseumCards(criteria) {
  const collection = getCollection();
  const eligible = [];

  for (const setId of Object.keys(collection)) {
    for (const cardId of Object.keys(collection[setId])) {
      const entry = collection[setId][cardId];
      if (!matchesMuseumCriteria(setId, cardId, criteria)) continue;

      const rawCount = rawCopiesAvailable(setId, cardId, entry.count);
      const entryLocked = entry.locked !== false;
      const available = entryLocked ? Math.max(0, rawCount - 1) : rawCount;

      if (available > 0) {
        eligible.push({ setId, cardId, available });
      }
    }
  }
  return eligible;
}`;

const newEligible = `export function getEligibleMuseumCards(criteria) {
  return runWithCollectionCache(() => {
    const collection = getCollection();
    const eligible = [];

    for (const setId of Object.keys(collection)) {
      const setMap = getCachedSetCardsMap(setId);
      for (const cardId of Object.keys(collection[setId])) {
        const entry = collection[setId][cardId];
        if (!matchesMuseumCriteria(setId, cardId, criteria, setMap)) continue;

        const rawCount = rawCopiesAvailable(setId, cardId, entry.count);
        const entryLocked = entry.locked !== false;
        const available = entryLocked ? Math.max(0, rawCount - 1) : rawCount;

        if (available > 0) {
          eligible.push({ setId, cardId, available });
        }
      }
    }
    return eligible;
  });
}`;

content = content.replace(oldEligible, newEligible);

fs.writeFileSync(file, content);
