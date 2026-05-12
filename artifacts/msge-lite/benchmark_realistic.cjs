const { performance } = require('perf_hooks');

const numCards = 250;
const setCards = [];
for (let i = 0; i < numCards; i++) {
  setCards.push({
    id: `card_${i}`,
    name: `Card ${i}`,
    supertype: 'Pokémon',
    evolvesFrom: i % 3 !== 0 ? `Card ${i-1}` : null,
    evolvesTo: i % 3 !== 2 ? [`Card ${i+1}`] : null
  });
}

const getCachedSetCards = () => setCards;

function buildEvolutionChain_old(apiCard, setId) {
  const setCards = getCachedSetCards(setId) || [];
  const pokémon  = setCards.filter(c => c.supertype === 'Pokémon');
  const byName   = (n) => pokémon.find(c => c.name === n);
  const chain    = [];
  const visited  = new Set();

  let cursor = apiCard;
  while (cursor?.evolvesFrom && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const prev = byName(cursor.evolvesFrom);
    if (!prev) break;
    chain.unshift(prev);
    cursor = prev;
  }
  chain.push(apiCard);

  cursor = apiCard;
  visited.clear();
  while (cursor?.evolvesTo?.length > 0 && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const next = byName(cursor.evolvesTo[0]);
    if (!next || next.id === apiCard.id) break;
    chain.push(next);
    cursor = next;
  }
  return chain.length > 1 ? chain : null;
}

function buildEvolutionChain_new(apiCard, setId) {
  const setCards = getCachedSetCards(setId) || [];
  const pokémon  = setCards.filter(c => c.supertype === 'Pokémon');

  const map = new Map(pokémon.map(c => [c.name, c]));
  const byName = (n) => map.get(n);

  const chain    = [];
  const visited  = new Set();

  let cursor = apiCard;
  while (cursor?.evolvesFrom && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const prev = byName(cursor.evolvesFrom);
    if (!prev) break;
    chain.unshift(prev);
    cursor = prev;
  }
  chain.push(apiCard);

  cursor = apiCard;
  visited.clear();
  while (cursor?.evolvesTo?.length > 0 && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const next = byName(cursor.evolvesTo[0]);
    if (!next || next.id === apiCard.id) break;
    chain.push(next);
    cursor = next;
  }
  return chain.length > 1 ? chain : null;
}

// Warmup
for (let i = 0; i < 1000; i++) {
  buildEvolutionChain_old(setCards[100], 'set1');
  buildEvolutionChain_new(setCards[100], 'set1');
}

const startOld = performance.now();
for (let i = 0; i < 10000; i++) {
  buildEvolutionChain_old(setCards[100], 'set1');
}
const endOld = performance.now();

const startNew = performance.now();
for (let i = 0; i < 10000; i++) {
  buildEvolutionChain_new(setCards[100], 'set1');
}
const endNew = performance.now();

console.log(`Old: ${(endOld - startOld).toFixed(2)}ms`);
console.log(`New: ${(endNew - startNew).toFixed(2)}ms`);
