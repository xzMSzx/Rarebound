/**
 * ui/archiveServicesScreen.js — v1.6.0
 *
 * AGS — Archive Grading Services screen.
 *
 * v1.6.0 layout:
 *   1. Hero panel       — brand, prestige messaging, live stats
 *   2. Pill nav         — [Registry · Active · Eligible]   (Registry default)
 *   3. Active panel     — only the currently selected tab's section is rendered
 *   4. About AGS footer — kept always-visible at bottom
 *
 * Each pill cross-fades the inner panel. State persists in `_state.activeTab`.
 *
 * Performance notes:
 *   - All slab elements use the lightweight CSS-only renderer.
 *   - "Eligible cards" + "Registry" lists are virtualized to the first 30
 *     rows with a "Show more" expander.
 *   - Tick subscription re-renders the screen so timers + statuses update.
 */

import {
  getActiveSubmissions, getCompletedSlabs, getAgsStats,
  statusLabelFor, timeRemainingLabel, progressFor, lockedCopiesFor,
  nextSubmittableCopyN, submitForGrading, SUBMISSION_TIERS,
} from '../data/agsSubmissionManager.js';
import { isEligibleRarity } from '../data/cardQualityManager.js';
import { getCollection } from '../data/collectionManager.js';
import { getCachedSetCards } from '../data/cardPoolManager.js';
import { mapPokemonRarity } from '../data/rarityMapper.js';
import { getMarketValue, getAllMarketValues } from '../data/marketValue.js';
import { gradedValueFromRaw, gradedDeltaForSlab } from '../data/agsMarketIntegration.js';
import { showAgsSubmissionModal } from './agsSubmissionModal.js';
import { openSlabViewer } from './slabViewer.js';
import { renderSlab } from './slabRenderer.js';

const ELIGIBLE_LABELS = {
  doubleRare:'Double Rare', ultraRare:'Ultra Rare',
  illustrationRare:'Illustration Rare', specialIllustrationRare:'Special Illustration',
  hyperRare:'Hyper Rare',
};

let _state = {
  activeTab:    'registry', // registry | active | eligible
  registrySort: 'highest_grade',
  expandedEligible: false,
  expandedRegistry: false,
};

let _hookedTick = false;

// ─── Public ──────────────────────────────────────────────────────────────────

export function openArchiveServicesScreen(hooks) {
  const screen = document.getElementById('archive-services-screen');
  if (!screen) {
    console.error('[AGS] open aborted — archive-services-screen missing from DOM');
    return;
  }
  renderArchiveServicesScreen(hooks);
  screen.style.display = 'flex';
  requestAnimationFrame(() => screen.classList.remove('hidden'));

  if (!_hookedTick) {
    _hookedTick = true;
    document.addEventListener('ags-tick', () => {
      const s = document.getElementById('archive-services-screen');
      if (s && !s.classList.contains('hidden')) renderArchiveServicesScreen(hooks);
    });
  }
}

export function closeArchiveServicesScreen() {
  const screen = document.getElementById('archive-services-screen');
  if (!screen) return;
  screen.classList.add('hidden');
  setTimeout(() => {
    if (screen.classList.contains('hidden')) screen.style.display = 'none';
  }, 240);
  document.dispatchEvent(new CustomEvent('archive-services-closed'));
}

/**
 * v1.6.0 — Allow callers (Collection "Archived" pill) to deep-link to a tab.
 */
export function setAgsActiveTab(tab) {
  if (['registry','active','eligible'].includes(tab)) _state.activeTab = tab;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderArchiveServicesScreen(hooks) {
  const screen = document.getElementById('archive-services-screen');
  if (!screen) return;

  const stats     = getAgsStats();
  const active    = getActiveSubmissions();
  const completed = getCompletedSlabs();
  const allValues = getAllMarketValues();

  let totalArchive = 0;
  for (const slab of completed) {
    const raw = allValues[slab.cardId] ?? 0;
    totalArchive += gradedValueFromRaw(raw, slab.grade);
  }

  const hero = renderHero({
    active: stats.active,
    archived: stats.archived,
    highest: stats.highestSlab,
    totalArchive,
  });

  const eligibleRows = collectEligibleRows(allValues);
  const registrySorted = sortRegistry(completed, allValues);

  screen.innerHTML = `
    <div class="screen-header ags-screen-header ags-screen-header--minimal">
      <button class="screen-back-btn" id="ags-back-btn">← Back</button>
      <div class="screen-spacer"></div>
      <div class="screen-spacer"></div>
    </div>

    <div class="ags-screen-body ags-screen-body--spacious">
      ${hero}

      ${renderTabNav({
        registry: completed.length,
        active:   active.length,
        eligible: eligibleRows.length,
      })}

      <div class="ags-tab-panel" id="ags-tab-panel">
        ${_state.activeTab === 'registry' ? renderRegistryPanel(registrySorted, totalArchive) : ''}
        ${_state.activeTab === 'active'   ? renderActivePanel(active) : ''}
        ${_state.activeTab === 'eligible' ? renderEligiblePanel(eligibleRows) : ''}
      </div>

      <section class="ags-section ags-section--info">
        <h2 class="ags-section__title">About AGS</h2>
        <p class="ags-info-text">
          Archive Grading Services preserves and authenticates your most significant pulls.
          Submission tiers determine turnaround speed — never the grade. Certified slabs
          remain in your registry permanently and may appear in long-term collection milestones.
        </p>
      </section>
    </div>
  `;

  // Mount registry slabs into their tile wrappers (DOM, not HTML strings)
  if (_state.activeTab === 'registry') {
    const registryVisible = _state.expandedRegistry ? registrySorted : registrySorted.slice(0, 30);
    const grid = screen.querySelector('#ags-registry-grid');
    if (grid) {
      for (const slab of registryVisible) {
        const apiCard = lookupApiCard(slab.setId, slab.cardId);
        const raw     = allValues[slab.cardId] ?? 0;
        const tile    = buildRegistryTile(slab, apiCard, raw);
        grid.appendChild(tile);
      }
    }
  }

  wireInteractions(screen, hooks);
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

function renderTabNav({ registry, active, eligible }) {
  const tab = (id, label, count) => `
    <button class="rb-pill ags-tab-pill ${_state.activeTab === id ? 'is-active' : ''}"
            data-tab="${id}" type="button">
      <span class="rb-pill__label">${label}</span>
      <span class="rb-pill__count">${count}</span>
    </button>
  `;
  return `
    <nav class="rb-pill-row ags-tab-nav" role="tablist" aria-label="Archive Services sections">
      ${tab('registry', 'Registry', registry)}
      ${tab('active',   'Active',   active)}
      ${tab('eligible', 'Eligible', eligible)}
    </nav>
  `;
}

// ─── Registry panel (default) ────────────────────────────────────────────────

function renderRegistryPanel(registrySorted, totalArchive) {
  if (registrySorted.length === 0) {
    return `
      <section class="ags-section">
        <div class="ags-section__head">
          <h2 class="ags-section__title">Archive Registry</h2>
        </div>
        <div class="ags-empty">Your registry is empty. Certified slabs will be archived here permanently.</div>
      </section>
    `;
  }
  return `
    <section class="ags-section">
      <div class="ags-section__head">
        <h2 class="ags-section__title">Archive Registry</h2>
        <div class="ags-section__hint">${registrySorted.length} certified ${registrySorted.length === 1 ? 'slab' : 'slabs'} · $${totalArchive.toFixed(2)} total</div>
      </div>
      <div class="ags-registry-controls">
        <label class="ags-registry-sort">
          Sort
          <select id="ags-registry-sort">
            <option value="highest_grade" ${_state.registrySort === 'highest_grade' ? 'selected' : ''}>Highest grade</option>
            <option value="highest_value" ${_state.registrySort === 'highest_value' ? 'selected' : ''}>Highest value</option>
            <option value="newest"        ${_state.registrySort === 'newest'        ? 'selected' : ''}>Newest</option>
            <option value="rarest"        ${_state.registrySort === 'rarest'        ? 'selected' : ''}>Rarest</option>
          </select>
        </label>
      </div>
      <div class="ags-registry-grid" id="ags-registry-grid"></div>
      ${registrySorted.length > 30 ? `
        <button class="ags-show-more" id="ags-registry-toggle" type="button">
          ${_state.expandedRegistry ? 'Show fewer' : `Show all ${registrySorted.length}`}
        </button>
      ` : ''}
    </section>
  `;
}

/**
 * v1.6.0 Registry tile:
 *   .registry-tile
 *     .registry-tile__head      — AGS badge + grade label + serial
 *     .registry-tile__slab-host — compact slab mounts here
 *     .registry-tile__value     — raw → archive value with delta %
 */
function buildRegistryTile(slab, apiCard, rawValue) {
  const tile = document.createElement('div');
  tile.className = 'registry-tile';
  const tierClass = (slab.grade?.tier?.id || 'na').toLowerCase().replace(/_/g, '-');
  tile.classList.add(`registry-tile--${tierClass}`);

  const gradeLabel = slab.grade?.tier?.label || 'Graded';
  const serial     = slab.serial || '—';
  const delta      = gradedDeltaForSlab(slab, rawValue);
  const deltaSign  = delta.deltaPct >= 0 ? '+' : '';

  tile.innerHTML = `
    <div class="registry-tile__head">
      <div class="registry-tile__badge">AGS</div>
      <div class="registry-tile__grade">${gradeLabel}</div>
      <div class="registry-tile__serial">${serial}</div>
    </div>
    <div class="registry-tile__slab-host"></div>
    <div class="registry-tile__value">
      <div class="registry-tile__val-cell registry-tile__val-cell--raw">
        <span class="registry-tile__val-key">Raw</span>
        <span class="registry-tile__val-num">$${delta.raw.toFixed(2)}</span>
      </div>
      <div class="registry-tile__val-arrow">→</div>
      <div class="registry-tile__val-cell registry-tile__val-cell--graded">
        <span class="registry-tile__val-key">Archive</span>
        <span class="registry-tile__val-num">$${delta.graded.toFixed(2)}</span>
      </div>
      <div class="registry-tile__val-delta ${delta.deltaPct >= 0 ? 'is-up' : 'is-down'}">${deltaSign}${delta.deltaPct}%</div>
    </div>
  `;

  const slabHost = tile.querySelector('.registry-tile__slab-host');
  const slabEl   = renderSlab(slab, apiCard, { variant: 'compact', showSerial: false });
  slabHost.appendChild(slabEl);

  tile.style.cursor = 'pointer';
  tile.addEventListener('click', () => openSlabViewer(slab, apiCard, { rawValue }));
  return tile;
}

// ─── Active panel ────────────────────────────────────────────────────────────

function renderActivePanel(active) {
  return `
    <section class="ags-section">
      <div class="ags-section__head">
        <h2 class="ags-section__title">Active Review</h2>
        <div class="ags-section__hint">${active.length} ${active.length === 1 ? 'submission' : 'submissions'} pending</div>
      </div>
      ${active.length === 0
        ? `<div class="ags-empty">No active submissions. Submit an eligible card from the Eligible tab to begin certification.</div>`
        : `<div class="ags-active-grid">${active.map(renderActiveTile).join('')}</div>`
      }
    </section>
  `;
}

// ─── Eligible panel ──────────────────────────────────────────────────────────

function renderEligiblePanel(eligibleRows) {
  const visible = _state.expandedEligible ? eligibleRows : eligibleRows.slice(0, 30);
  return `
    <section class="ags-section">
      <div class="ags-section__head">
        <h2 class="ags-section__title">Eligible Cards</h2>
        <div class="ags-section__hint">${eligibleRows.length} eligible ${eligibleRows.length === 1 ? 'copy' : 'copies'}</div>
      </div>
      ${eligibleRows.length === 0
        ? `<div class="ags-empty">Pull a Double Rare or higher card to unlock submission.</div>`
        : `
          <div class="ags-eligible-grid">${visible.map(renderEligibleTile).join('')}</div>
          ${eligibleRows.length > 30 ? `
            <button class="ags-show-more" id="ags-eligible-toggle" type="button">
              ${_state.expandedEligible ? 'Show fewer' : `Show all ${eligibleRows.length}`}
            </button>
          ` : ''}
        `
      }
    </section>
  `;
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function renderHero({ active, archived, highest, totalArchive }) {
  const highestLabel = highest ? `${highest.grade.label}` : '—';
  return `
    <section class="ags-hero">
      <div class="ags-hero__sweep" aria-hidden="true"></div>
      <div class="ags-hero__brand">
        <span class="ags-hero__brand-mark">AGS</span>
        <span class="ags-hero__brand-name">Archive Grading Services</span>
      </div>
      <div class="ags-hero__tagline">Preservation. Authentication. Prestige.</div>
      <div class="ags-hero__stats">
        <div class="ags-hero__stat">
          <div class="ags-hero__stat-num">${active}</div>
          <div class="ags-hero__stat-label">${active === 1 ? 'Card under review' : 'Cards under review'}</div>
        </div>
        <div class="ags-hero__stat">
          <div class="ags-hero__stat-num">${archived}</div>
          <div class="ags-hero__stat-label">${archived === 1 ? 'Archived slab' : 'Archived slabs'}</div>
        </div>
        <div class="ags-hero__stat">
          <div class="ags-hero__stat-num">${highestLabel}</div>
          <div class="ags-hero__stat-label">Highest grade</div>
        </div>
        <div class="ags-hero__stat">
          <div class="ags-hero__stat-num">$${totalArchive.toFixed(0)}</div>
          <div class="ags-hero__stat-label">Total archive value</div>
        </div>
      </div>
    </section>
  `;
}

// ─── Active submission tile ─────────────────────────────────────────────────

function renderActiveTile(sub) {
  const apiCard = lookupApiCard(sub.setId, sub.cardId);
  const status  = statusLabelFor(sub);
  const remain  = timeRemainingLabel(sub);
  const pct     = Math.max(2, Math.round(progressFor(sub) * 100));
  const tier    = SUBMISSION_TIERS[sub.tier];
  const imgUrl  = apiCard?.images?.small || '';
  return `
    <div class="ags-active-tile" data-uid="${sub.uid}">
      ${imgUrl
        ? `<img class="ags-active-tile__art" src="${imgUrl}" alt="${apiCard?.name || ''}" loading="lazy" />`
        : `<div class="ags-active-tile__art ags-active-tile__art--missing">${apiCard?.name || ''}</div>`
      }
      <div class="ags-active-tile__body">
        <div class="ags-active-tile__name">${apiCard?.name || sub.cardId}</div>
        <div class="ags-active-tile__tier">${tier?.label || sub.tier}</div>
        <div class="ags-active-tile__status">${status}</div>
        <div class="ags-active-tile__bar"><span style="width:${pct}%"></span></div>
        <div class="ags-active-tile__remain">${remain} remaining</div>
      </div>
    </div>
  `;
}

// ─── Eligible cards ─────────────────────────────────────────────────────────

function collectEligibleRows(allValues) {
  const collection = getCollection();
  const rows = [];
  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCards(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    for (const [cardId, entry] of Object.entries(cards)) {
      const apiCard = byId[cardId];
      if (!apiCard) continue;
      const tier = mapPokemonRarity(apiCard.rarity);
      if (!isEligibleRarity(tier)) continue;
      const owned  = entry.count || 0;
      const locked = lockedCopiesFor(setId, cardId);
      const free   = owned - locked;
      if (free <= 0) continue;
      const value = allValues[cardId] ?? getMarketValue(cardId, tier);
      rows.push({ setId, cardId, apiCard, tier, owned, locked, free, value });
    }
  }
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

function renderEligibleTile(row) {
  const imgUrl = row.apiCard.images?.small || '';
  return `
    <div class="ags-eligible-tile" data-set="${row.setId}" data-card="${row.cardId}" data-tier="${row.tier}">
      ${imgUrl
        ? `<img class="ags-eligible-tile__art" src="${imgUrl}" alt="${row.apiCard.name || ''}" loading="lazy" />`
        : `<div class="ags-eligible-tile__art ags-eligible-tile__art--missing">${row.apiCard.name || ''}</div>`
      }
      <div class="ags-eligible-tile__name">${row.apiCard.name || row.cardId}</div>
      <div class="ags-eligible-tile__rarity">${ELIGIBLE_LABELS[row.tier] || row.tier}</div>
      <div class="ags-eligible-tile__value">$${row.value.toFixed(2)} raw · ${row.free}/${row.owned} free</div>
      <div class="ags-eligible-tile__candidate">Potential candidate</div>
      <button class="ags-eligible-tile__submit" type="button"
              data-submit-uid="${row.setId}:${row.cardId}"
              data-set="${row.setId}" data-card="${row.cardId}" data-tier="${row.tier}">
        Submit to AGS
      </button>
    </div>
  `;
}

// ─── Wire interactions (single function, called once per render) ────────────

function wireInteractions(screen, hooks) {
  const backBtn = screen.querySelector('#ags-back-btn');
  backBtn?.addEventListener('click', closeArchiveServicesScreen);

  // Tab pills
  screen.querySelectorAll('.ags-tab-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tab = pill.getAttribute('data-tab');
      if (tab === _state.activeTab) return;
      _state.activeTab = tab;
      renderArchiveServicesScreen(hooks);
    });
  });

  // Submit buttons (Eligible panel)
  screen.querySelectorAll('[data-submit-uid]').forEach(btn => {
    btn.addEventListener('click', () => onSubmitClicked(btn, hooks));
  });

  const eligibleToggle = screen.querySelector('#ags-eligible-toggle');
  eligibleToggle?.addEventListener('click', () => {
    _state.expandedEligible = !_state.expandedEligible;
    renderArchiveServicesScreen(hooks);
  });

  const registryToggle = screen.querySelector('#ags-registry-toggle');
  registryToggle?.addEventListener('click', () => {
    _state.expandedRegistry = !_state.expandedRegistry;
    renderArchiveServicesScreen(hooks);
  });

  const sortSelect = screen.querySelector('#ags-registry-sort');
  sortSelect?.addEventListener('change', (e) => {
    _state.registrySort = e.target.value;
    renderArchiveServicesScreen(hooks);
  });
}

// ─── Submit click handler ───────────────────────────────────────────────────

function onSubmitClicked(btn, hooks) {
  const setId  = btn.getAttribute('data-set');
  const cardId = btn.getAttribute('data-card');
  const tier   = btn.getAttribute('data-tier');
  const apiCard = lookupApiCard(setId, cardId);
  if (!apiCard) return;

  const ownedCount = getCollection()[setId]?.[cardId]?.count || 0;
  const copyN = nextSubmittableCopyN(setId, cardId, ownedCount);
  if (!copyN) {
    hooks.showToast?.('No free copies available for submission.', 'warn');
    return;
  }

  const value = getAllMarketValues()[cardId] ?? getMarketValue(cardId, tier);
  const quality = window.__rb_getOrCreateQuality
    ? window.__rb_getOrCreateQuality(setId, cardId, copyN, tier)
    : null;

  showAgsSubmissionModal(apiCard, {
    quality,
    rarityLabel: ELIGIBLE_LABELS[tier] || tier,
    estimatedRawValue: value,
    balance: hooks.getBalance(),
    onSubmit: ({ tier: tierId, cost }) => {
      if (!hooks.spendBalance(cost)) {
        hooks.showToast?.('Insufficient funds for submission.', 'warn');
        return;
      }
      const sub = submitForGrading({ setId, cardId, copyN, tier: tierId, rarity: tier });
      if (!sub) {
        hooks.showToast?.('Submission could not be queued.', 'warn');
        return;
      }
      hooks.onBalanceChanged?.();
      hooks.haptic?.('medium');
      hooks.showToast?.(`Submitted ${apiCard.name} to AGS.`, 'rep');
      hooks.logActivity?.('ags_submitted',
        `AGS · submitted ${apiCard.name} (${SUBMISSION_TIERS[tierId].label})`);
      // Auto-jump to Active tab so the player can see what they just submitted
      _state.activeTab = 'active';
      renderArchiveServicesScreen(hooks);
    },
  });
}

// ─── Registry sort + lookup helpers ─────────────────────────────────────────

function sortRegistry(slabs, allValues) {
  const sorted = slabs.slice();
  switch (_state.registrySort) {
    case 'highest_value':
      sorted.sort((a, b) => {
        const va = gradedValueFromRaw(allValues[a.cardId] ?? 0, a.grade);
        const vb = gradedValueFromRaw(allValues[b.cardId] ?? 0, b.grade);
        return vb - va;
      });
      break;
    case 'newest':
      sorted.sort((a, b) => (b.gradedAt || 0) - (a.gradedAt || 0));
      break;
    case 'rarest':
      sorted.sort((a, b) => rarityRank(b) - rarityRank(a));
      break;
    case 'highest_grade':
    default:
      sorted.sort((a, b) => (b.grade?.tier?.rank || 0) - (a.grade?.tier?.rank || 0));
  }
  return sorted;
}

function rarityRank(slab) {
  const order = ['doubleRare','ultraRare','illustrationRare','specialIllustrationRare','hyperRare'];
  const apiCard = lookupApiCard(slab.setId, slab.cardId);
  if (!apiCard) return 0;
  const t = mapPokemonRarity(apiCard.rarity);
  return order.indexOf(t) + 1;
}

function lookupApiCard(setId, cardId) {
  const cached = getCachedSetCards(setId) || [];
  return cached.find(c => c.id === cardId) || null;
}
