/**
 * data/museumManager.js — Phase 2C
 *
 * Museum Exchange and Curator Reputation System.
 * Persistent archive contributions and prestigious thematic exhibitions.
 */

import { getCollection, decrementCard } from './collectionManager.js';
import { getCachedSetCardsMap } from './cardPoolManager.js';
import { mapPokemonRarity } from './rarityMapper.js';
import { rawCopiesAvailable } from './agsAvailability.js';
import { addPrestigeBonus } from './prestigeManager.js';

const STORAGE_KEY = 'tcg_museum_state';

const CURATOR_RANKS = [
  { min: 0,    name: 'Archivist',              description: 'A novice in the preservation of history.' },
  { min: 50,   name: 'Conservator',            description: 'Trusted with delicate restorations.' },
  { min: 150,  name: 'Preservation Associate', description: 'Recognized for significant archival contributions.' },
  { min: 350,  name: 'Senior Curator',         description: 'A leader in thematic exhibitions.' },
  { min: 700,  name: 'Museum Benefactor',      description: 'A cornerstone of the museum network.' },
  { min: 1500, name: 'Grand Archivist',        description: 'A legendary protector of the cards.' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { curatorRep: 0, exhibition: null }; }
  catch { return { curatorRep: 0, exhibition: null }; }
}
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

export function getCuratorReputation() { return load().curatorRep; }

export function getCuratorRank() {
  const rep = getCuratorReputation();
  let cur = CURATOR_RANKS[0];
  for (let i = 0; i < CURATOR_RANKS.length; i++) {
    if (rep >= CURATOR_RANKS[i].min) cur = CURATOR_RANKS[i];
  }
  return cur;
}

export function addCuratorReputation(amount) {
  if (!amount || amount < 0) return;
  const s = load();
  s.curatorRep += amount;
  save(s);
}

// Exhibition pool
const EXHIBITION_POOLS = [
  {
    id: 'kanto_origins',
    title: 'Kanto Origins Showcase',
    flavor: 'Collector interest in early-generation artwork has surged.',
    requestText: 'Seeking 3 cards from the Kanto era.',
    criteria: { kind: 'set', setIds: ['sv3pt5'] },
    goalRange: [3, 5],
    rewardRep: 15,
    rewardPrestige: 25
  },
  {
    id: 'paldea_contemporary',
    title: 'Paldea Contemporary Gallery',
    flavor: 'A modern exhibition of Paldean illustration.',
    requestText: 'Seeking Illustration Rares from contemporary Paldea-era collections.',
    criteria: { kind: 'rarity', rarity: 'illustrationRare', setIds: ['sv2', 'sv4pt5', 'sv6', 'sv8pt5'] },
    goalRange: [1, 2],
    rewardRep: 25,
    rewardPrestige: 50
  },
  {
    id: 'dragon_archive',
    title: 'Dragon Archive Initiative',
    flavor: 'Curators are restoring a dragon-focused historical archive.',
    requestText: 'Seeking 3 Dragon-type specimens.',
    criteria: { kind: 'type', type: 'Dragon' },
    goalRange: [2, 4],
    rewardRep: 20,
    rewardPrestige: 30
  },
  {
    id: 'illustration_preservation',
    title: 'Illustration Preservation',
    flavor: 'Protecting culturally significant card artwork for future generations.',
    requestText: 'Seeking 2 Illustration Rares or Special Illustration Rares.',
    criteria: { kind: 'rarity', rarities: ['illustrationRare', 'specialIllustrationRare'] },
    goalRange: [1, 2],
    rewardRep: 35,
    rewardPrestige: 60
  }
];

export function getActiveExhibition() {
  const s = load();
  const now = Date.now();
  if (!s.exhibition || now > s.exhibition.expiresAt || s.exhibition.progress >= s.exhibition.goal) {
    const pool = EXHIBITION_POOLS[Math.floor(Math.random() * EXHIBITION_POOLS.length)];
    const goal = pool.goalRange[0] + Math.floor(Math.random() * (pool.goalRange[1] - pool.goalRange[0] + 1));
    s.exhibition = {
      ...pool,
      goal,
      progress: 0,
      expiresAt: now + 24 * 3600 * 1000 // 24 hours
    };
    save(s);
  }
  return s.exhibition;
}

export function matchesMuseumCriteria(setId, cardId, criteria) {
  if (criteria.kind === 'set') return criteria.setIds.includes(setId);
  
  const cachedMap = getCachedSetCardsMap(setId);
  const apiCard = cachedMap ? cachedMap.get(cardId) : undefined;
  if (!apiCard) return false;

  if (criteria.setIds && !criteria.setIds.includes(setId)) return false;

  if (criteria.kind === 'type') {
    return Array.isArray(apiCard.types) && apiCard.types.includes(criteria.type);
  }
  if (criteria.kind === 'rarity') {
    const r = mapPokemonRarity(apiCard.rarity);
    if (criteria.rarities) return criteria.rarities.includes(r);
    return r === criteria.rarity;
  }
  return false;
}

export function getEligibleMuseumCards(criteria) {
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
}

export function contributeToMuseum(setId, cardId) {
  const s = load();
  if (!s.exhibition) return false;
  
  decrementCard(setId, cardId);
  
  s.exhibition.progress += 1;
  save(s);
  
  addCuratorReputation(5); // base rep per card
  
  if (s.exhibition.progress >= s.exhibition.goal) {
    addPrestigeBonus(s.exhibition.rewardPrestige, 'Exhibition Completed');
    addCuratorReputation(s.exhibition.rewardRep);
  }
  
  return true;
}