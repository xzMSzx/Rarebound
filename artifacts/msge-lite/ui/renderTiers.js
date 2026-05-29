/**
 * ui/renderTiers.js
 *
 * Universal Render Tier Architecture.
 * Serves as the single source of truth for card capabilities across the app.
 * Used to protect CPU and GPU from heavy effects running on large lists.
 */

export const CARD_RENDER_TIERS = {
  THUMBNAIL: 'thumbnail',
  INTERACTIVE: 'interactive',
  SHOWCASE: 'showcase'
};

export const TIER_CAPABILITIES = {
  [CARD_RENDER_TIERS.THUMBNAIL]: {
    tilt: false,
    glare: false,
    holo: false,
    particles: false
  },
  [CARD_RENDER_TIERS.INTERACTIVE]: {
    tilt: true,
    glare: true,
    holo: false,
    particles: false
  },
  [CARD_RENDER_TIERS.SHOWCASE]: {
    tilt: true,
    glare: true,
    holo: true,
    particles: true
  }
};

/**
 * Helper to retrieve capabilities for a given tier.
 * Defauts to THUMBNAIL (safest) if unknown.
 */
export function getTierCapabilities(tier) {
  return TIER_CAPABILITIES[tier] || TIER_CAPABILITIES[CARD_RENDER_TIERS.THUMBNAIL];
}
