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
    title: 'Rarity Guide',
    body: `
      Every card in RAREBOUND belongs to a rarity tier. Higher rarities are
      significantly harder to pull and often carry stronger collector demand,
      higher market valuation, and greater archive prestige.
      <br><br>

      <div class="help-rarity-table">
        <div class="help-rarity-row"><span class="r-name">Common</span><span class="r-sym">◇</span></div>
        <div class="help-rarity-row"><span class="r-name">Uncommon</span><span class="r-sym">◇◇</span></div>
        <div class="help-rarity-row"><span class="r-name">Rare</span><span class="r-sym">★</span></div>
        <div class="help-rarity-row"><span class="r-name">Holo Rare</span><span class="r-sym">★</span></div>
        <div class="help-rarity-row"><span class="r-name">Double Rare (ex)</span><span class="r-sym">★★</span></div>
        <div class="help-rarity-row"><span class="r-name">Illustration Rare</span><span class="r-sym">★★</span></div>
        <div class="help-rarity-row"><span class="r-name">Ultra Rare</span><span class="r-sym">★★★</span></div>
        <div class="help-rarity-row"><span class="r-name">Special Illustration Rare</span><span class="r-sym">✦★</span></div>
        <div class="help-rarity-row"><span class="r-name">Hyper Rare</span><span class="r-sym">👑</span></div>
      </div>

      <br>
      Illustration Rare and Special Illustration Rare cards are designed as
      collector-focused chase pulls, while Hyper Rares represent the absolute
      pinnacle of pack openings.
    `,
  },
  {
    title: 'Vendor Hub Explained',
    body: `
      Four vendors, four personalities:
      • <strong>PokéMart</strong> — modern, reliable stock, slight discount. Consistent pulls, beginner-friendly.
      • <strong>Retro Vault</strong> — vintage premium pricing. Rare slots have a higher chance of upgrading to Holo Rare.
      • <strong>Night Market</strong> — volatile. Rare slots can upgrade <em>or</em> downgrade, giving wilder pulls.
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
    title: 'Collector Rank & Progression',
    body: `
      Reputation is your overall standing as a collector. You earn points by pulling
      rare cards, completing sets, hitting wishlist cards, and reaching favor
      milestones — never from selling. Reputation never decreases. Tap the rank
      strip at the top of the Vendor Hub — or the Collector Rank card on the Stats
      screen — to open the <strong>Collector Archive</strong>, which shows your rank
      timeline and all milestone categories. Higher ranks surface bigger requests,
      broker prestige contracts, and rarer mystery box drops. Your daily stipend
      also increases with each rank, from $10 at Rookie Collector to $60 at the top.
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
    title: 'Reverse Holo Variants',
    body: `
      Occasionally, a pack's reverse holo slot produces a Reverse Holo variant of
      a common, uncommon, or rare card. These aren't separate binder slots — they're
      stored as a variant count on the same card entry. Look for the small
      <strong>RH</strong> badge on a binder slot to know you own at least one
      Reverse Holo copy. The card detail view shows the exact count. Retro Vault
      packs tend to produce higher-quality variant pulls due to their curated stock.
    `,
  },
  {
    title: 'Recent Activity',
    body: `
      A compact activity feed appears at the bottom of the Vendor Hub once you've
      made your first action. It logs pack opens (with notable pulls), stipend
      claims, fulfilled requests, and Broker acquisitions — all with a relative
      timestamp. The feed stores the last 20 events and refreshes every time the
      hub re-renders. It's a quick pulse on your session progress without cluttering
      the main interface.
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
      The Broker only opens Friday through Sunday and stocks rare singles typically
      priced $250–$700, with premium cards occasionally reaching $800–$1,000. The
      weekly inventory is keyed to Friday and stays consistent across the weekend.
      Tap any Broker card to jump directly to its binder location — owned cards show
      full art, unowned cards appear blurred to maintain the mystery. The Acquire
      button still commits the purchase without leaving. The Broker also posts the
      most prestigious vendor requests — see <strong>Broker Economy</strong> below.
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
    title: 'Collector Requests',
    body: `
      Each vendor periodically posts requests for specific kinds of cards —
      a Pokémon type, a rarity tier, or cards from a particular set. Fulfilling a
      request pays cash and builds favor with that vendor. Most requests prefer
      <em>duplicates</em>, so you can profit without breaking up your collection.
      Wishlisted cards and your sole copies are never touched, and locked cards
      always preserve at least one copy.
      The kinds of requests that appear scale with your <strong>Collector Rank</strong>
      — early players see common-tier duplicate requests, late-game players see
      premium prestige contracts.
    `,
  },
  {
    title: 'Dynamic Demand',
    body: `
      Every request carries a demand modifier that shifts its payout up or down.
      <strong>PokéMart</strong> stays steady (0 to +20%). <strong>Retro Vault</strong> swings wider for vintage holos
      (-10 to +35%). <strong>Night Market</strong> is the most volatile (-20 to +60%) — sometimes a
      bargain, sometimes a windfall. <strong>The Broker</strong> always pays a premium (+10 to +50%)
      but only on serious cards. Demand re-rolls on each rotation.
    `,
  },
  {
    title: 'Duplicate Strategy',
    body: `
      Selling every duplicate the moment it appears isn't always optimal.
      Holding a small backlog of duplicates lets you fulfill higher-paying requests
      when demand spikes — especially Night Market and Broker bounties. Think of
      duplicates as a working inventory, not waste.
    `,
  },
  {
    title: 'Collector Archive',
    body: `
      The Collector Archive is your central progression hub. Open it by tapping the
      rank strip at the top of the Vendor Hub or the Collector Rank card on the
      Stats screen. It shows your current rank with its atmospheric description,
      your progress toward the next rank, all milestone categories, and the full
      rank progression timeline. Milestones are revealed progressively — you always
      see your current goal without the whole list being spoiled up front.
    `,
  },
  {
    title: 'Milestones',
    body: `
      Milestones are one-time achievements spread across five categories:
      <strong>Collection</strong> (growing and completing binders),
      <strong>Pack Opening</strong> (opening counts and rare discoveries),
      <strong>Market &amp; Economy</strong> (selling, requests, revenue),
      <strong>Reputation</strong> (reaching rank thresholds), and
      <strong>Rare Hunter</strong> (owning ultra and secret rares). Each milestone
      auto-claims the moment its condition is met, crediting cash and reputation
      directly to your save. New milestones are revealed as you complete earlier
      ones — so there's always a visible next goal without the full list being
      shown at once.
    `,
  },
  {
    title: 'Duplicate Management',
    body: `
      Open the Stats screen and tap the <strong>Duplicates</strong> card to enter the
      Duplicate Vault — a single screen showing every spare copy in your
      collection, sorted by backlog value. From here you can jump straight to
      a card's binder slot to sell it, or hold the duplicates back to fulfill
      higher-paying vendor requests. Sole copies and locked last-copies never
      appear here, so it's safe to manage. Duplicates also power the
      <em>Smart Seller</em> and <em>Contract Specialist</em> milestones.
    `,
  },
  {
    title: 'Dynamic Stipend',
    body: `
      Your daily collector stipend scales with your reputation rank and varies
      slightly each day within a range. Rookie Collectors earn $10–15 per day,
      growing to $20–25 at Collector, $30–40 at Advanced, $45–50 at Elite,
      $52–58 at Master, and $58–65 at Archive Curator and above. The exact
      amount is locked for the full calendar day — check back tomorrow for a
      fresh roll. Claim your stipend from the Vendor Hub each day.
    `,
  },
  {
    title: 'Recovery Mode',
    body: `
      If your balance drops below $8, Recovery Mode activates and a red banner
      appears at the top of the Vendor Hub. Recovery Mode is a real safety net
      built on three layers:
      <br><br>
      <strong>Emergency Requests</strong> — one vendor takes the recovery focus
      and posts a single Emergency contract in their request panel. These
      contracts have easier requirements and pay better than normal requests, so
      you can earn quick cash from cards you already own. The focus rotates
      between vendors every 45 minutes.
      <br><br>
      <strong>Vendor Relief Stipend</strong> — a $15-25 failsafe payment built
      into the banner itself. It can be claimed once every 24 hours while you're
      in Recovery, and grants no reputation or favor — pure survival support.
      <br><br>
      <strong>Vendor personality</strong> — not every vendor will help. PokéMart
      always extends a hand. Retro Vault only helps trusted collectors (level 3
      favor or Collector rank+). Night Market always shows up but with volatile,
      risky contracts. The Broker stays cold during Recovery and only surfaces
      rare prestige liquidations for Master Collectors and above.
      <br><br>
      Recovering from distress also unlocks the <em>Recovered Collector</em>
      milestone.
    `,
  },
  {
    title: 'Milestones & Collector Archive',
    body: `
      The Collector Archive (tap your rank strip) is now organized into nine
      themed milestone categories, with around 70 individual goals to chase.
      <br><br>
      <strong>Collection</strong>, <strong>Pack Opening</strong>, <strong>Market
      &amp; Economy</strong>, <strong>Reputation</strong>, and <strong>Rare
      Hunter</strong> cover the core game loop. Four new categories add deeper
      progression: <strong>Vendor Loyalty</strong> (favor with each vendor and
      cross-vendor relationships), <strong>Set Mastery</strong> (sets touched,
      half-completed, fully completed), <strong>Discovery</strong> (rarity
      breadth, distinct tier ownership, broker patronage), and
      <strong>Endurance</strong> (long-haul pack and revenue tiers).
      <br><br>
      Milestones use progressive revelation — you always see your next reachable
      goal, but later goals stay hidden until you're closer to them. Rewards are
      auto-claimed in the background, so you'll see toast notifications when you
      complete one. Reaching prestige ranks (Master Collector and above) also
      lights up gold accents on your rank strip.
    `,
  },
  {
    title: 'Vendor Personalities',
    body: `
      Each of the four vendors has a distinct character — most visible during
      Recovery Mode, but it shapes their normal behavior too.
      <br><br>
      <strong>PokéMart</strong> — reliable and fair. Cheapest emergency requests,
      always willing to help, lower payouts. The safe option.
      <br><br>
      <strong>Retro Vault</strong> — selective but generous. Won't extend
      recovery help unless you've earned their trust (favor level 3 or higher,
      or Collector rank and above). When they do help, payouts skew higher.
      <br><br>
      <strong>Night Market</strong> — chaotic. Emergency contracts can pay big
      or pay little, and may carry "volatile", "risky", or "unverified" tags.
      Risk and reward in equal measure.
      <br><br>
      <strong>The Broker</strong> — cold and status-driven. Closes prestige
      inventory the moment you enter Recovery. At Master Collector and above
      they may rarely surface a Prestige Liquidation contract — single
      hyper-rare acquisition for $250-1000 — but only on a roughly 30% chance
      per rotation. Never something to count on.
    `,
  },
  {
    title: 'Broker Economy',
    body: `
      The Broker is acquisition-focused. Their contracts come in two flavors:
      <strong>duplicate</strong> contracts (spare high-rarity cards) and
      <strong>prestige acquisitions</strong> ("Museum Acquisition", "Private Buyer",
      "Archive Commission") that can consume any unlocked owned copy. Payouts
      are dynamic — estimated sell value × contract bonus (+15-40%) × demand
      multiplier — and range from about $120 for the smallest contracts up to
      a hard cap of $1000 for top-tier hyper rares. The Broker rotates roughly
      every eight hours and only one or two contracts are active at a time, so
      they always feel rare and worth the trip.
    `,
  },
  {
    title: 'Collection Prestige',
    body: `
      Prestige is a quiet, museum-style measure of your collection's quality —
      separate from money, reputation, and rank. It's derived from what you own
      (rarer cards count more), the sets you've completed, the milestones you've
      claimed, and a small bonus pool that grows when you pull a wishlisted card
      or hit a major chase. You'll see your tier on the Stats screen — names like
      <em>Distinguished</em>, <em>Elite Archive</em>, <em>Curated Vault</em>. It's
      cosmetic recognition, not power. The point is identity, not progression bars.
    `,
  },
  {
    title: 'Archive History',
    body: `
      The Archive History panel on the Stats screen is your private collector log.
      It records first-of-a-kind events the way a real archive would — your first
      Illustration Rare, your first set completion, a wishlist hit, a Recovery Mode
      survival, a new lifetime peak in collection value. Each entry is dated by
      collector day so you can trace the shape of your collection over time. It is
      not a feed; it does not refresh. Old entries stay where they are.
    `,
  },
  {
    title: 'Vendor World Events',
    body: `
      Occasionally a vendor will surface a small atmospheric event — PokéMart
      "Modern Stock Overflow" trims a few percent off pack prices, Retro Vault's
      "Archive Recovery Week" boosts reverse-holo finds, Night Market's
      "Shadow Demand Spike" makes prices wilder, the Broker's "Prestige
      Acquisition Window" thickens chase inventory. Events appear as a single
      line on the vendor card, last about three hours, and have long quiet
      windows between them. Nothing flashes; nothing demands attention.
    `,
  },
  {
    title: 'Prestige Pulls',
    body: `
      Some pulls deserve a moment. When you hit an Illustration Rare, Hyper Rare,
      Special Illustration Rare, or a wishlisted card, the reveal lingers, the
      glow deepens, and a single line of atmospheric collector text appears —
      <em>"Archive-worthy acquisition."</em>, <em>"Preservation recommended."</em>
      The pull is also recorded in your Archive History so you can find it later.
      Restrained on purpose — it should feel like collector awe, not a slot
      machine.
    `,
  },
  {
    title: 'Collection Value History',
    body: `
      The Stats screen tracks one collection-value snapshot per day, kept for
      roughly three months. You'll see today's value, the change from yesterday,
      and your lifetime peak. The small sparkline shows your trajectory at a
      glance. Use it to feel growth over weeks, not minutes — the whole system
      is designed to reward patience.
    `,
  },
  {
    title: 'Long-Term Progression',
    body: `
      Late-game milestones intentionally lean less on cash. As you climb, rewards
      shift toward favor boosts, temporary vendor discounts, prestige points, and
      archive recognition. The economy is meant to support continued pack opening
      and acquisition, not to inflate balances past the point where price still
      matters. Recovery Mode, vendor relief, and emergency requests remain the
      safety net at the bottom; everything above it stays meaningful.
    `,
  },
  {
    title: 'AGS · Archive Grading Services',
    body: `
      AGS is the long-term preservation layer of RAREBOUND. Eligible cards (Double
      Rare and above) can be submitted for archival certification. A graded card
      is no longer a duplicate — it becomes a preserved artifact in your registry,
      with its own slab, certification serial, and value multiplier. Access AGS
      from the <strong>Archive Grading Services</strong> panel on the My Collection
      screen, or from the AGS card on the Statistics screen.
    `,
  },
  {
    title: 'AGS · Grading Explained',
    body: `
      Every eligible card pulled from a pack carries hidden quality metadata —
      centering, surface, edges, corners, and print quality. Submission converts
      that hidden state into a visible AGS grade. Service tier never affects
      the grade; only the underlying card condition does. Two copies of the same
      card can grade differently, so submission is meaningful.
    `,
  },
  {
    title: 'AGS · Archive Pristine & Black Label',
    body: `
      Standard tiers run AGS 6 (Played) through AGS 9.5 (Pristine). AGS 10 —
      <em>Archive Pristine</em> — is rare. <em>Black Label</em> is the apex: every
      subgrade must clear 95 with a weighted average of 96.5+. Encountering one
      is a moment.
    `,
  },
  {
    title: 'AGS · Slab Multipliers',
    body: `
      Graded cards trade at a multiplier of their raw market value. The bands
      are roughly: AGS 7 ≈ 1.1×, AGS 8 ≈ 1.3×, AGS 9 ≈ 1.8×, AGS 9.5 ≈ 3×,
      AGS 10 ≈ 5–10×, Black Label far higher. The actual figure depends on the
      card's hidden quality fingerprint, so identical grades can still vary.
    `,
  },
  {
    title: 'AGS · Submission Tiers',
    body: `
      Three service tiers control turnaround — never the grade itself:
      • <strong>Standard Review</strong> — $40, 6h.
      • <strong>Priority Review</strong> — $90, 1h.
      • <strong>Prestige Archive</strong> — $200, 30m. Includes a cinematic
      certification ceremony and gold serial engraving.
      All tiers produce the same museum-grade slab viewer when you open your
      certified card — full subgrade breakdown, archive details, and graded
      valuation built into the slab itself.
    `,
  },
  {
    title: 'AGS · Archive Registry',
    body: `
      Every certified slab is permanently archived in your Registry — sortable by
      grade, value, recency, or rarity. Tap any slab tile to open the full-screen
      slab viewer: a museum-grade nested-shell display showing the card, grade
      disc, per-category subgrades, archive details (date, service level,
      turnaround, serial), and a live graded valuation. The registry is your
      late-game trophy room.
    `,
  },
  {
    title: 'Favorite Collection',
    body: `
      Mark any owned card with the heart icon in its detail view to add it to
      your <strong>Favorite Collection</strong> — a personal, curated showcase
      separate from your binders. Open it any time from the <strong>★ Favorites</strong>
      button on the My Collection header. Favorites carry no gameplay weight,
      grant no currency, and never gate progression — they're purely about the
      cards <em>you</em> consider yours.
    `,
  },
  {
    title: 'Archive Services Entry',
    body: `
      AGS now lives where it belongs — inside your collection, not the top
      navigation. Open <strong>My Collection</strong> and tap the
      <strong>Archive Grading Services</strong> panel above your binders, or
      use the AGS card on the Statistics screen. Both lead to the same Archive
      Services screen with hero stats, active submissions, eligible cards, and
      the registry.
    `,
  },
  {
    title: 'Card Preservation',
    body: `
      Two systems work together to keep cards safe. <strong>Locked first
      copies</strong> protect against accidental sales — your sole copy of any
      card cannot be sold without an explicit unlock confirmation. The
      <strong>Favorites Collection</strong> adds a second emotional safety net:
      selling a favorited card surfaces a "this card is part of your favorites"
      notice in the sell dialog, so you always have a moment to reconsider.
    `,
  },
  {
    title: 'AGS Tab Navigation',
    body: `
      The Archive Services screen is split into three tabs:
      <strong>Registry</strong> (your certified slabs), <strong>Active</strong>
      (submissions still under review), and <strong>Eligible</strong> (cards
      ready to submit). Registry is the default — it's your trophy room.
      Submitting a card auto-jumps you to Active so you can watch the timer.
    `,
  },
  {
    title: 'Raw → Archive Value',
    body: `
      Every certified slab now shows the difference between its raw market
      value and its graded archive value, with the gain percentage. Raw value
      drifts naturally with the market; the archive multiplier is fixed by
      the grade. The delta moves with the raw price — pristine slabs of
      trending cards swing meaningfully.
    `,
  },
  {
    title: 'Binder Grade Indicators',
    body: `
      Cards you've sent through AGS now carry a small grade medallion in the
      top-right of their binder slot, plus a faint per-tier acrylic edge.
      Higher tiers glow more visibly — AGS 10 and Black Label stand out
      across a full binder page. Tap the slot to open the card detail and
      jump straight to the slab.
    `,
  },
{
    title: 'Cloud Archive Sync',
    body: `
      Authenticated collector accounts can upload secure cloud snapshots of
      their archive progression. Uploading stores a full snapshot of your current save to your account-bound
      cloud archive. Restoring from the cloud replaces your active local progress
      with the uploaded archive state. This allows seamless cross-device restoration between desktop and mobile sessions.
    `,
  },
  {
    title: 'Profile-Isolated Persistence',
    body: `
      RAREBOUND now supports isolated save environments for every collector profile.
      Guest progression remains local to the device, while authenticated accounts
      load their own independent archive state and cloud synchronization.
      Logging out safely returns you to the Guest profile without deleting
      local guest progression.
    `,
  },
  {
    title: 'Archive Liquidation',
    body: `
      Certified AGS slabs can now be liquidated directly into the collector market.
      Higher grades retain stronger liquidity and collector demand, while
      Prestige Archive slabs receive elevated collector confidence and reduced
      archival commission fees. Liquidation permanently transfers the certified slab out of your archive.
    `,
  },
  {
    title: 'Prestige Archive Slabs',
    body: `
      Prestige Archive certification represents the highest level of museum-grade
      presentation available within AGS. Prestige slabs feature:<br>
      • premium slab styling<br>
      • cinematic certification reveals<br>
      • elevated collector demand<br>
      • luxury archival presentation<br>
      These slabs are considered elite collector artifacts across the archive ecosystem.
    `,
  },
  {
    title: 'Collection Filters',
    body: `
      The My Collection header now stays clean — Wishlist and Favorites moved
      into a pill row right below the title, joined by an
      <strong>⬢ Archived</strong> shortcut that drops you straight into the
      AGS Registry. The pills are navigation pivots, not filters of the set
      list — they take you to a dedicated screen when tapped.
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
