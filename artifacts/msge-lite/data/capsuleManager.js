import { getActiveGlobalState, getVendorOperationalState } from './vendorStateManager.js';

export const CAPSULE_ARCHETYPES = [
  {
    id: 'archive',
    name: 'Archive Capsule',
    tag: 'Measured',
    price: 32,
    bias: 'Contemporary collector demand stable.',
    signal: 'Illustration pressure elevated.',
    rewards: ['Modern sealed pull table', 'Stable outcomes', 'Premium modern atmosphere'],
    sets: ['sv6', 'sv8a'],
    rarityShaping: { rare: { doubleRare: 0.1, illustrationRare: 0.05, rare: 0.85 } }
  },
  {
    id: 'distortion',
    name: 'Distortion Capsule',
    tag: 'Unstable',
    price: 24,
    bias: 'Distribution irregularities detected.',
    signal: 'Volatility index above baseline.',
    rewards: ['Wide rarity variance', 'Strong jackpot potential', 'Occasional failures'],
    sets: ['sv8', 'sv7'],
    rarityShaping: { rare: { holoRare: 0.2, secretRare: 0.05, uncommon: 0.25, rare: 0.5 } }
  },
  {
    id: 'prism',
    name: 'Prism Capsule',
    tag: 'Scarce',
    price: 50,
    bias: 'Luxury archival sourcing active.',
    signal: 'Collector-grade capsule integrity verified.',
    rewards: ['Lower quantity', 'Premium card weighting', 'Elite pulls'],
    sets: ['sv8a'],
    rarityShaping: { rare: { doubleRare: 0.15, ultraRare: 0.1, secretRare: 0.05, rare: 0.7 } }
  }
];

export function getDailyCapsules() {
  const day = Math.floor(Date.now() / 86400000);
  const featuredIndex = day % 3;
  
  return CAPSULE_ARCHETYPES.map((capsule, index) => {
    const isFeatured = index === featuredIndex;
    const item = { ...capsule, isFeatured };
    
    // Apply world state hooks
    const globalState = getActiveGlobalState();
    if (globalState) {
      if (globalState.id === 'illustration_boom' && item.id === 'archive') {
        item.signal = 'Illustration Boom: IR probability significantly elevated.';
        item.rarityShaping = { rare: { illustrationRare: 0.15, doubleRare: 0.1, rare: 0.75 } };
      }
      if (globalState.id === 'underground_activity' && item.id === 'distortion') {
        item.signal = 'Underground Activity: Volatility critical.';
        item.rarityShaping = { rare: { secretRare: 0.1, uncommon: 0.4, rare: 0.5 } };
      }
      if (globalState.id === 'archive_prestige_spike' && item.id === 'prism') {
        item.signal = 'Prestige Spike: Collector messaging intensified.';
        item.price = 60;
        item.rarityShaping = { rare: { doubleRare: 0.2, ultraRare: 0.15, secretRare: 0.1, rare: 0.55 } };
      }
    }
    
    return item;
  });
}
