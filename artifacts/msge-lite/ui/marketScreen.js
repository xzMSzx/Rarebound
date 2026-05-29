/**
 * ui/marketScreen.js — Phase 9.8
 *
 * Lightweight market-trends browser. Two surfaces:
 *
 *   1. List screen (#market-screen) — searchable / filterable / sortable
 *      table of every card with a known market value. Each row shows a
 *      mini SVG sparkline of recent value history.
 *
 *   2. Graph modal (#market-graph-modal) — large SVG line chart for a
 *      single card with reasoning text and quick stats.
 *
 * Pure DOM strings + inline SVG. No external chart libraries.
 */

import { getAllMarketValues, getMarketValue } from '../data/marketValue.js';
import {
  getHistory, getMovementPct, getRange, getVolatility, getAllHistory, bulkSeedIfEmpty, seedInitialHistory,
} from '../data/marketHistory.js';
import { getCachedSetCards } from '../data/cardPoolManager.js';
import { mapPokemonRarity } from '../data/rarityMapper.js';
import { getCollection } from '../data/collectionManager.js';
import { PACK_STORE } from '../data/packStore.js';
import { getCurrentTrend } from '../data/economyManager.js';
import { isChaseCard, getChaseBoost } from '../data/chaseManager.js';
import { CARD_RENDER_TIERS } from './renderTiers.js';

const SET_IDS = ['swsh7', 'sv4pt5', 'sv3pt5', 'sv2', 'swsh11', 'sv6', 'sv7', 'sv8', 'sv8pt5', 'sv9'];

const RARITY_LABELS = {
  common:'Common', uncommon:'Uncommon', rare:'Rare', holoRare:'Holo Rare',
  doubleRare:'Double Rare', illustrationRare:'Illustration Rare', ultraRare:'Ultra Rare',
  specialIllustrationRare:'Special Illustration Rare', hyperRare:'Hyper Rare',
};

let _state = {
  setFilter: 'all',
  search:    '',
  sort:      'gainers',
};

// ─── Card index ──────────────────────────────────────────────────────────────

function buildCardIndex() {
  const idx = {};
  for (const setId of SET_IDS) {
    const cached = getCachedSetCards(setId) || [];
    for (const c of cached) {
      idx[c.id] = { apiCard: c, setId };
    }
  }
  return idx;
}

// ─── Public ──────────────────────────────────────────────────────────────────

export function openMarketScreen() {
  const screen = document.getElementById('market-screen');
  if (!screen) return;
  renderMarketScreen();
  screen.style.display = 'flex';
  requestAnimationFrame(() => screen.classList.remove('hidden'));
}

export function closeMarketScreen() {
  const screen = document.getElementById('market-screen');
  if (!screen) return;
  screen.classList.add('hidden');
  setTimeout(() => { if (screen.classList.contains('hidden')) screen.style.display = 'none'; }, 240);
  // Notify host (main.js) so it can release the body-scroll lock.
  document.dispatchEvent(new CustomEvent('market-screen-closed'));
}

// ─── List render ─────────────────────────────────────────────────────────────

function renderMarketScreen() {
  const screen = document.getElementById('market-screen');
  const values = getAllMarketValues();
  const idx    = buildCardIndex();
  // Snapshot history once per render — avoids re-parsing localStorage per row.
  const histAll = getAllHistory();

  // Bulk-seed any card that has market value but no history yet (single write).
  const toSeed = Object.entries(values)
    .filter(([cardId, value]) => !histAll[cardId]?.length && idx[cardId])
    .map(([cardId, value]) => ({
      cardId, value,
      tier: mapPokemonRarity(idx[cardId].apiCard.rarity) || 'common',
    }));
  if (toSeed.length) {
    bulkSeedIfEmpty(toSeed);
    // Refresh snapshot so rows get the freshly seeded data.
    Object.assign(histAll, getAllHistory());
  }

  // Build row data
  let rows = Object.entries(values)
    .map(([cardId, value]) => {
      const meta    = idx[cardId];
      if (!meta) return null;
      const tier    = mapPokemonRarity(meta.apiCard.rarity) || 'common';
      const hist    = histAll[cardId] || [];
      // Compute movement from cached history (mirror of getMovementPct logic).
      const move = hist.length < 2 ? 0
        : ((hist[hist.length - 1].v - hist[0].v) / hist[0].v) * 100;
      // Apply chase boost cosmetically to the displayed value.
      const boost   = 1 + (getChaseBoost(cardId) / 100);
      return {
        cardId, value: value * boost, move, tier, hist,
        name:    meta.apiCard.name,
        imageUrl:meta.apiCard.images.large || meta.apiCard.images.small,
        setId:   meta.setId,
      };
    })
    .filter(Boolean);

  // Filter
  if (_state.setFilter !== 'all') rows = rows.filter(r => r.setId === _state.setFilter);
  if (_state.search) {
    const q = _state.search.toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(q));
  }

  // Sort
  switch (_state.sort) {
    case 'gainers':  rows.sort((a, b) => b.move  - a.move);  break;
    case 'drops':    rows.sort((a, b) => a.move  - b.move);  break;
    case 'value':    rows.sort((a, b) => b.value - a.value); break;
    case 'trending': {
      const t = getCurrentTrend();
      rows.sort((a, b) => {
        const ax = (t?.rarities?.includes(a.tier) ? 1 : 0) + Math.abs(a.move) / 100;
        const bx = (t?.rarities?.includes(b.tier) ? 1 : 0) + Math.abs(b.move) / 100;
        return bx - ax;
      });
      break;
    }
  }

  rows = rows.slice(0, 120);     // cap render

  const setOptions = ['<option value="all">All sets</option>',
    ...SET_IDS.map(id => `<option value="${id}" ${_state.setFilter === id ? 'selected' : ''}>${PACK_STORE[id]?.name || id}</option>`)
  ].join('');

  screen.innerHTML = `
    <div class="screen-header">
      <button class="screen-back-btn" id="market-back-btn">← Back</button>
      <h2>Market Trends</h2>
      <div></div>
    </div>

    <div class="market-controls">
      <select id="market-set-filter" class="market-select">${setOptions}</select>
      <input id="market-search" class="market-search" type="text" placeholder="Search cards…" value="${_state.search}" aria-label="Search cards" />
      <select id="market-sort" class="market-select">
        <option value="gainers"  ${_state.sort === 'gainers'  ? 'selected' : ''}>Highest gainers</option>
        <option value="drops"    ${_state.sort === 'drops'    ? 'selected' : ''}>Biggest drops</option>
        <option value="value"    ${_state.sort === 'value'    ? 'selected' : ''}>Most valuable</option>
        <option value="trending" ${_state.sort === 'trending' ? 'selected' : ''}>Trending now</option>
      </select>
    </div>

    <p class="market-hint">Tap a card to inspect market history</p>

    <div class="market-list" id="market-list">
      ${rows.length === 0
        ? `<div class="market-empty">No cards match your filters yet.</div>`
        : rows.map(renderRowHTML).join('')}
    </div>
  `;

  // Wire controls
  screen.querySelector('#market-back-btn').onclick = closeMarketScreen;
  screen.querySelector('#market-set-filter').onchange = (e) => { _state.setFilter = e.target.value; renderMarketScreen(); };
  screen.querySelector('#market-sort').onchange       = (e) => { _state.sort      = e.target.value; renderMarketScreen(); };
  const searchEl = screen.querySelector('#market-search');
  searchEl.oninput = (e) => { _state.search = e.target.value; debouncedRefresh(); };

  // Wire row clicks
  screen.querySelectorAll('.market-row').forEach(row => {
    row.onclick = () => openGraphModal(row.dataset.cardId);
  });
}

let _searchDebounce;
function debouncedRefresh() {
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(renderMarketScreen, 180);
}

function renderRowHTML(r) {
  const sign  = r.move >= 0 ? '+' : '';
  const moveCls = r.move > 0.5 ? 'up' : r.move < -0.5 ? 'down' : 'flat';
  const chase = isChaseCard(r.cardId) ? '<span class="market-chase-pip">🔥</span>' : '';
  return `
    <div class="market-row" data-card-id="${r.cardId}" data-render-tier="${CARD_RENDER_TIERS.THUMBNAIL}">
      <img class="market-row-img" src="${r.imageUrl}" alt="" loading="lazy" decoding="async"/>
      <div class="market-row-info">
        <div class="market-row-name">${r.name}${chase}</div>
        <div class="market-row-meta">${RARITY_LABELS[r.tier] || r.tier} · ${PACK_STORE[r.setId]?.name || r.setId}</div>
      </div>
      <div class="market-row-spark">${sparklineSVG(r.hist, 64, 22, moveCls)}</div>
      <div class="market-row-numbers">
        <div class="market-row-value">$${r.value.toFixed(2)}</div>
        <div class="market-row-move market-row-move--${moveCls}">${sign}${r.move.toFixed(1)}%</div>
      </div>
    </div>
  `;
}

// ─── Sparkline (SVG) ─────────────────────────────────────────────────────────

function sparklineSVG(history, w, h, cls) {
  if (history.length < 2) {
    return `<svg width="${w}" height="${h}"><line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="#444" stroke-width="1"/></svg>`;
  }
  const vals = history.map(p => p.v);
  const min  = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const step = w / (history.length - 1);
  const pts  = history.map((p, i) => {
    const x = i * step;
    const y = h - ((p.v - min) / span) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const stroke = cls === 'up' ? '#4ade80' : cls === 'down' ? '#f87171' : '#888';
  return `<svg width="${w}" height="${h}"><polyline fill="none" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/></svg>`;
}

// ─── Graph modal ─────────────────────────────────────────────────────────────

function openGraphModal(cardId) {
  const modal  = document.getElementById('market-graph-modal');
  const idx    = buildCardIndex();
  const meta   = idx[cardId];
  if (!meta || !modal) return;

  const tier    = mapPokemonRarity(meta.apiCard.rarity) || 'common';
  const boost   = 1 + (getChaseBoost(cardId) / 100);
  const rawVal  = getMarketValue(cardId, tier);
  const value   = rawVal * boost;

  // Ensure at least seed data exists before rendering the graph.
  seedInitialHistory(cardId, rawVal, tier);

  const history = getHistory(cardId);
  const move    = getMovementPct(cardId);
  const range   = getRange(cardId);
  const vol     = getVolatility(cardId);
  const isSeededOnly = history.length <= 5 && history.every(p => p.t < Date.now() - 3_600_000);

  // Ownership %
  const collection = getCollection();
  const owns       = !!collection[meta.setId]?.[cardId];
  const setCards   = getCachedSetCards(meta.setId) || [];
  const ownedCount = setCards.reduce((n, c) => n + (collection[meta.setId]?.[c.id] ? 1 : 0), 0);
  const ownPct     = setCards.length ? (ownedCount / setCards.length) * 100 : 0;

  modal.innerHTML = `
    <div class="graph-modal-content" id="graph-modal-content">
      <button class="graph-close-btn" id="graph-close-btn" aria-label="Close">×</button>
      <img class="graph-card-art" data-render-tier="${CARD_RENDER_TIERS.SHOWCASE}" src="${meta.apiCard.images.large || meta.apiCard.images.small}" alt="${meta.apiCard.name}" loading="eager" decoding="async" />
      <div class="graph-card-name">${meta.apiCard.name}</div>
      <div class="graph-card-meta">${RARITY_LABELS[tier] || tier} · ${PACK_STORE[meta.setId]?.name || meta.setId}</div>
      <div class="graph-card-value">$${value.toFixed(2)} <span class="graph-move-${move >= 0 ? 'up' : 'down'}">${move >= 0 ? '+' : ''}${move.toFixed(1)}%</span></div>
      <div class="graph-trend-status graph-trend-status--${trendStatusCls(move, vol)}">${trendStatusLabel(move, vol)}</div>

      <div class="graph-chart" id="graph-chart-host">
        ${largeChartSVG(history, 320, 140, move >= 0)}
        <div class="graph-tooltip" id="graph-tooltip"></div>
      </div>
      ${isSeededOnly ? `<div class="graph-early-hint">Market history is still developing.</div>` : ''}

      <div class="graph-reasoning">${reasoningText(tier, move)}</div>

      <div class="graph-stats">
        <div class="graph-stat"><div class="graph-stat-label">7-day high</div><div class="graph-stat-val">$${range.max.toFixed(2)}</div></div>
        <div class="graph-stat"><div class="graph-stat-label">7-day low</div><div class="graph-stat-val">$${range.min.toFixed(2)}</div></div>
        <div class="graph-stat"><div class="graph-stat-label">Volatility</div><div class="graph-stat-val">${(vol * 100).toFixed(1)}%</div></div>
        <div class="graph-stat"><div class="graph-stat-label">Set owned</div><div class="graph-stat-val">${ownPct.toFixed(0)}%${owns ? ' ✓' : ''}</div></div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  const close = () => {
    modal.classList.add('hidden');
    setTimeout(() => { if (modal.classList.contains('hidden')) modal.style.display = 'none'; }, 240);
  };
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('#graph-close-btn').onclick = close;

  // Animate the line draw
  requestAnimationFrame(() => {
    const path = modal.querySelector('.graph-line');
    if (path) {
      const len = path.getTotalLength();
      path.style.strokeDasharray  = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();   // force layout
      path.style.transition = 'stroke-dashoffset 1.2s ease-out';
      path.style.strokeDashoffset = 0;
    }
  });

  // Tooltip / cursor on the graph
  wireGraphTooltip(modal, history);
}

function wireGraphTooltip(modal, history) {
  if (history.length < 2) return;
  const host    = modal.querySelector('#graph-chart-host');
  const svg     = host?.querySelector('svg.graph-svg');
  const tooltip = modal.querySelector('#graph-tooltip');
  if (!host || !svg || !tooltip) return;

  const w = 320, h = 140, padX = 8, padY = 12;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  const vals = history.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const step = innerW / (history.length - 1);

  // Cursor elements (SVG)
  const ns = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('class', 'graph-cursor-line');
  line.setAttribute('y1', padY); line.setAttribute('y2', h - padY);
  line.style.opacity = 0;
  svg.appendChild(line);
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('class', 'graph-cursor-dot');
  dot.setAttribute('r', 3.5);
  dot.style.opacity = 0;
  svg.appendChild(dot);

  const move = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const xRatio = (clientX - rect.left) / rect.width;
    const xPx = Math.max(0, Math.min(1, xRatio)) * w;
    let i = Math.round((xPx - padX) / step);
    i = Math.max(0, Math.min(history.length - 1, i));
    const pt = history[i];
    const x  = padX + i * step;
    const y  = padY + innerH - ((pt.v - min) / span) * innerH;

    line.setAttribute('x1', x); line.setAttribute('x2', x);
    dot.setAttribute('cx', x);  dot.setAttribute('cy', y);
    line.style.opacity = 1; dot.style.opacity = 1;

    const hostRect = host.getBoundingClientRect();
    const svgRect  = svg.getBoundingClientRect();
    const offsetL  = svgRect.left - hostRect.left;
    const offsetT  = svgRect.top - hostRect.top;
    const px = offsetL + (x / w) * svgRect.width;
    const py = offsetT + (y / h) * svgRect.height;
    tooltip.style.left = px + 'px';
    tooltip.style.top  = py + 'px';
    const date = new Date(pt.t);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    tooltip.innerHTML = `<span class="graph-tooltip-val">$${pt.v.toFixed(2)}</span><span class="graph-tooltip-time">${label}</span>`;
    tooltip.classList.add('is-visible');
  };
  const hide = () => {
    tooltip.classList.remove('is-visible');
    line.style.opacity = 0; dot.style.opacity = 0;
  };

  svg.addEventListener('mousemove', e => move(e.clientX));
  svg.addEventListener('mouseleave', hide);
  svg.addEventListener('touchstart', e => { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove',  e => { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchend',   hide);
}

function trendStatusLabel(move, vol) {
  const v = vol * 100;
  if (v > 12)        return 'Volatile';
  if (move > 8)      return 'Surging';
  if (move > 2)      return 'Rising';
  if (move < -5)     return 'Cooling';
  return 'Stable';
}

function trendStatusCls(move, vol) {
  const v = vol * 100;
  if (v > 12)    return 'volatile';
  if (move > 8)  return 'surging';
  if (move > 2)  return 'rising';
  if (move < -5) return 'cooling';
  return 'stable';
}

function largeChartSVG(history, w, h, isUp) {
  const padX = 8, padY = 12;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  const stroke = isUp ? '#4ade80' : '#f87171';
  const fill   = isUp ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.09)';

  // Render a flat reference line if there's only one point.
  if (history.length < 2) {
    const y = padY + innerH / 2;
    return `<svg width="${w}" height="${h}" class="graph-svg" viewBox="0 0 ${w} ${h}">
      <line x1="${padX}" y1="${y}" x2="${w-padX}" y2="${y}" stroke="#333" stroke-width="1.5" stroke-dasharray="4 3"/>
    </svg>`;
  }
  const vals = history.map(p => p.v);
  const min  = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const step = innerW / (history.length - 1);
  const pts  = history.map((p, i) => ({
    x: padX + i * step,
    y: padY + innerH - ((p.v - min) / span) * innerH,
  }));

  // Smooth path using cubic Bezier
  let path = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    path += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  // Filled area underneath
  const area = `${path} L ${pts[pts.length-1].x},${h-padY} L ${pts[0].x},${h-padY} Z`;

  // Y gridlines
  const grid = [0.25, 0.5, 0.75].map(f => {
    const y = padY + innerH * f;
    return `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="#252525" stroke-width="1"/>`;
  }).join('');

  return `<svg width="${w}" height="${h}" class="graph-svg" viewBox="0 0 ${w} ${h}">
    ${grid}
    <path d="${area}" fill="${fill}" stroke="none"/>
    <path class="graph-line" d="${path}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function reasoningText(tier, move) {
  const trend = getCurrentTrend();
  const tierLabel = RARITY_LABELS[tier] || tier;
  const factors = [];

  // Trend alignment (rarity-based)
  if (trend?.rarities?.includes(tier)) {
    const sign = trend.multiplier >= 1 ? 'lifting' : 'pressuring';
    factors.push(`Active trend "${trend.label}" is ${sign} ${tierLabel.toLowerCase()} cards.`);
  }
  // Trend alignment (set-based, surfaced via global rotation only)
  // Movement intensity
  if (Math.abs(move) < 0.5) {
    factors.push('Price is stable across recent refresh cycles — no breakout signal yet.');
  } else if (move >= 8) {
    factors.push('Sharp upward movement — secondary market demand spike for this rarity tier.');
  } else if (move >= 3) {
    factors.push('Steady accumulation by collectors over the last few cycles.');
  } else if (move <= -8) {
    factors.push('Significant correction — likely cooling after a recent peak.');
  } else if (move <= -3) {
    factors.push('Mild downward drift — broader rarity tier softening.');
  } else {
    const dir = move >= 0 ? 'upward' : 'downward';
    factors.push(`Light ${dir} pressure — within normal cycle volatility.`);
  }
  // Tier context
  if (tier === 'hyperRare' || tier === 'specialIllustrationRare') {
    factors.push('High-tier scarcity amplifies every refresh cycle\'s impact.');
  } else if (tier === 'common' || tier === 'uncommon') {
    factors.push('Bulk supply keeps movement narrow on this rarity.');
  }

  return factors.join(' ');
}
