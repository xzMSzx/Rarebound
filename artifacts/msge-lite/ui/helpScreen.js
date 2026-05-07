/**
 * ui/helpScreen.js — Phase 10
 *
 * Help Center with accordion sections. Plain-language onboarding for every
 * core system. Tone is clean and friendly — never technical jargon.
 */

import { haptic } from '../data/hapticManager.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';

const TOPICS = [
  {
    title: 'Getting Started',
    body: `
      Welcome to RAREBOUND — a calm space for opening packs and growing a real-feeling
      Pokémon TCG collection. You start with a $120 Starter Collector Grant and a daily stipend.
      Visit the Vendor Hub to buy packs from four different sellers, then watch your
      cards build up in My Collection.
    `,
  },
  {
    title: 'Opening Packs',
    body: `
      Tap a pack at any vendor to open it. Cards reveal one at a time —
      tap or swipe to flip them. Your pulls are saved automatically and the
      first copy of any new card is locked, so you can't accidentally sell it.
    `,
  },
  {
    title: 'Vendor Hub Explained',
    body: `
      Four vendors, four personalities:
      • <strong>PokéMart</strong> — modern, reliable stock, slight discount.
      • <strong>Retro Vault</strong> — vintage premium pricing.
      • <strong>Night Market</strong> — random discounts, rotating stock.
      • <strong>The Broker</strong> — chase singles. Open Friday through Sunday only.
    `,
  },
  {
    title: 'Vendor Favor',
    body: `
      Every purchase and sale builds favor with that vendor. Higher favor unlocks
      better prices and small holo bonuses. Favor is per-vendor — building it with
      one doesn't help with another.
    `,
  },
  {
    title: 'Collector Reputation',
    body: `
      Reputation is your overall standing as a collector. You earn points by pulling
      rare cards, completing sets, hitting wishlist cards, and reaching favor
      milestones. Reputation never goes down. Higher ranks unlock larger stipends
      and small prestige perks.
    `,
  },
  {
    title: 'Selling Cards',
    body: `
      Open any card in your binder and tap Sell. Each vendor takes a different
      commission, so payouts vary. Selling builds favor but does <em>not</em>
      grant reputation — only collecting does.
    `,
  },
  {
    title: 'Locked Cards',
    body: `
      Your first copy of every card is automatically locked to protect your collection.
      You can sell any duplicate freely. To sell a locked last copy, you must explicitly
      unlock it first — no accidents.
    `,
  },
  {
    title: 'Wishlist',
    body: `
      Star any unowned card from a binder to add it to your wishlist. When you finally
      pull a wishlisted card, you'll feel it — and earn a small reputation bonus.
    `,
  },
  {
    title: 'Market & Trends',
    body: `
      Card values drift on every refresh cycle, biased by the active market trend
      (e.g. "Fire-type demand rising"). Open the Market screen for a searchable list
      with mini sparklines, or tap any card for a 7-day graph with high/low and
      volatility readings.
    `,
  },
  {
    title: 'Daily Chase Cards',
    body: `
      Every 24 hours, one card is highlighted as the Daily Chase. Pulling it grants a
      temporary +10–25% market boost on that card. The chase rotates automatically.
    `,
  },
  {
    title: 'The Broker',
    body: `
      The Broker only opens Friday through Sunday and stocks rare singles for
      $350–$2,200. The weekly inventory is keyed to Friday and stays consistent
      across the weekend, so you can plan your purchase before stock rotates.
    `,
  },
  {
    title: 'Statistics',
    body: `
      The Stats screen shows your total spend, payout history, vendor favor breakdown,
      pull distribution by rarity, and other long-term trends.
    `,
  },
  {
    title: 'Mystery Boxes',
    body: `
      Sealed bundles containing 3 random packs from a weighted pool. The Night Market
      always carries the Midnight Bundle. Retro Vault occasionally stocks a Vintage
      Archive Crate, and The Broker can offer a Collector Cache. Outcomes hover near
      fair value — you'll see profits, fair trades, and small losses.
    `,
  },
  {
    title: 'Vendor Rotations',
    body: `
      Vendor stock and the active market trend rotate together every refresh cycle
      (30 minutes in dev, designed for 24h in production). The Broker's chase
      inventory is keyed to Friday and remains stable across the entire weekend.
    `,
  },
  {
    title: 'Chase Card System',
    body: `
      Every 24 hours one card is highlighted as the Daily Chase with a temporary
      +10–25% market value boost. Pulling it doesn't change pack odds — it just
      means the card is currently the most lucrative thing to chase.
    `,
  },
  {
    title: 'Developer Access',
    body: `
      A hidden archive utility for testing and content creation, tucked at the
      bottom of Settings. Unlocks tools like balance grants, vendor refresh, and
      market resets. Doesn't affect anything until you unlock it.
    `,
  },
  {
    title: 'Sandbox Mode',
    body: `
      When Infinite Balance is enabled inside Developer Access, the save enters
      Sandbox Mode — a small "DEV" badge appears in the corner and reputation
      gains are paused so casual testing can't contaminate your collector rank.
    `,
  },
  {
    title: 'Infinite Balance',
    body: `
      A developer toggle that lets purchases bypass the balance check. While on,
      reputation is paused (see Sandbox Mode). Selling still works normally.
      Turn it off to resume real-economy progression.
    `,
  },
  {
    title: 'Trusted Collector Status',
    body: `
      <em>Coming soon.</em> Long-term trust with each vendor will unlock early refresh
      previews, hidden Broker inventory, and improved Night Market discounts.
    `,
  },
];

let screenEl;

function render() {
  const sections = TOPICS.map((t, i) => `
    <div class="help-accordion" data-idx="${i}">
      <button class="help-accordion-head">
        <span class="help-accordion-title">${t.title}</span>
        <span class="help-accordion-chevron">+</span>
      </button>
      <div class="help-accordion-body">${t.body.trim()}</div>
    </div>
  `).join('');

  screenEl.innerHTML = `
    <div class="screen-header">
      <button class="screen-back-btn" id="help-back-btn">← Back</button>
      <h2>Help Center</h2>
      <div></div>
    </div>
    <div class="help-body">
      <div class="help-intro">
        Tap any topic to expand. RAREBOUND is built around calm, deliberate
        collecting — no pressure, no spam.
      </div>
      ${sections}
    </div>
  `;

  screenEl.querySelector('#help-back-btn').onclick = () => {
    haptic('soft');
    closeHelpScreen();
  };

  screenEl.querySelectorAll('.help-accordion-head').forEach(head => {
    head.addEventListener('click', () => {
      const acc = head.parentElement;
      const open = acc.classList.toggle('is-open');
      head.querySelector('.help-accordion-chevron').textContent = open ? '−' : '+';
      haptic('soft');
    });
  });
}

export function openHelpScreen() {
  screenEl = document.getElementById('help-screen');
  if (!screenEl) return;
  render();
  screenEl.style.display = 'flex';
  requestAnimationFrame(() => screenEl.classList.remove('hidden'));
  lockBodyScroll();
}

export function closeHelpScreen() {
  if (!screenEl) return;
  screenEl.classList.add('hidden');
  setTimeout(() => {
    if (screenEl.classList.contains('hidden')) screenEl.style.display = 'none';
  }, 240);
  unlockBodyScroll();
}
