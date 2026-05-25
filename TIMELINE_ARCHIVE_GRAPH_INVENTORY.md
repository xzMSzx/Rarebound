# Timeline, Archive & Collection Value Graph Systems Inventory

## Executive Summary

The Rarebound codebase implements three interconnected historical systems:

1. **Archive History** — Permanent, deduplicated log of prestige collector events
2. **Collection Value History** — Chronological value snapshots for lifetime peak tracking
3. **Stats Screen Timeline** — Interactive visual integration of value graph + archive events with clickable markers

These systems work together to create an atmospheric, long-term progression experience that rewards patient play and captures meaningful collector moments.

---

## System Architecture Overview

### Data Flow Hierarchy

```
Game Events (pack pull, set complete, etc.)
    ↓
recordArchiveEvent() / recordCollectionValueSnapshot()
    ↓
localStorage (tcg_archive_history / tcg_value_history)
    ↓
Stats Screen Rendering
    ├─ Value Timeline Graph (SVG path + area fill)
    ├─ Archive Event Markers (clickable circles on graph)
    └─ Archive Event Details (below timeline)
```

### Key Invariants

- **Archive History**: Permanent, oldest entries pruned at 200 cap
- **Value History**: Up to 200 points, stored chronologically with UTC day key
- **Deduplication**: Archive events with a `key` parameter are recorded once per unique key
- **Consistency**: Value snapshots occur when material change detected (≥$25 or ≥1% move)

---

## 1. Archive History System

### File: [data/archiveHistoryManager.js](artifacts/msge-lite/data/archiveHistoryManager.js)

**Purpose**: Permanent, prestigious log of first-of-a-kind collector moments (analogous to a museum archive).

**Storage Key**: `tcg_archive_history`

**Storage Schema**:
```javascript
{
  day0: number,                    // First record's midnight timestamp
  entries: Array<HistoryEntry>     // Max 200 (oldest pruned)
}

HistoryEntry = {
  ts: number,                      // Timestamp (Date.now())
  day: number,                     // Days since day0 (player calendar day)
  type: string,                    // Event category (see below)
  key?: string,                    // Optional: dedup key (first-of-a-kind only)
  label: string,                   // Human-readable event line
  meta?: object                    // Optional: extra payload (setId, cardName, etc.)
}
```

**Event Types**:
- `prestige_pull` — First pull of a secret/rare/hyper rarity
- `wishlist_hit` — Card on wishlist was pulled
- `set_completed` — Full set completion
- `recovery_survived` — Completed a recovery mode cycle
- `broker_acquisition` — Acquired card from The Broker
- `reverse_holo_complete` — Reverse holo variant milestone
- `value_milestone` — Collection value surpassed threshold ($500, $1000, $2000, etc.)
- `milestone_major` — Major prestige milestone completed
- `archive_record` — Custom archive entry
- `ags_submitted`, `ags_complete`, `ags_pristine`, `ags_black_label` — AGS grading events

**Key Functions**:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `recordArchiveEvent()` | `(type, label, {key?, meta?})` | Record new entry; dedup if key exists |
| `hasArchiveKey()` | `(key)` | Check if first-of-a-kind already logged |
| `getArchiveEntries()` | `(limit=6)` | Get most recent N entries (newest first) |
| `getAllArchiveEntries()` | `()` | Get all entries for full archive view |
| `getArchiveEntryCount()` | `()` | Total entries recorded |
| `clearArchiveHistory()` | `()` | Wipe all history (debug) |

**Recording Pattern**:
```javascript
// Prestige pull (first time)
recordArchiveEvent('prestige_pull', 
  `First Hyper Rare · ${cardName}`, 
  { key: 'first_hyper_rare' });

// Value milestone (dedup by value bracket)
const milestone = 1000;
recordArchiveEvent('value_milestone', 
  `Collection value surpassed $${milestone.toLocaleString()}`,
  { key: `collection_value_milestone:${milestone}` });
```

**Call Sites** (15+ locations in main.js):
- `runPackOpening()` — set completion, prestige pulls, wishlist hits
- `buyChaseCard()` — broker acquisitions
- `recordCollectionValueSnapshot()` — value milestones
- `enqueueAgsReveals()` — AGS completion events
- Recovery mode tick — recovery survival

---

## 2. Collection Value History System

### File: [data/collectionValueHistory.js](artifacts/msge-lite/data/collectionValueHistory.js)

**Purpose**: Chronological value snapshots for stats screen sparkline + lifetime peak tracking.

**Storage Key**: `tcg_value_history`

**Storage Schema**:
```javascript
{
  points: Array<{                  // Chronological samples
    day: string,                   // UTC day key (YYYY-MM-DD)
    value: number,                 // $ collection value at sample time
    ts: number                     // Exact timestamp
  }>,
  lifetimePeak: number,            // Highest value ever reached
  lifetimePeakAt: number           // Timestamp of peak
}
```

**Sampling Rules** — Append new point if ANY condition is true:
1. No previous points exist
2. Day changed (UTC midnight rollover)
3. Material move detected: `diff >= $25 OR diff >= 1% of previous value`
4. Heartbeat sample: `6 hours since last point AND diff >= $1`

Max 200 points; oldest pruned when exceeded.

**Key Functions**:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `recordValueSnapshot()` | `(value)` | Record sample if conditions met |
| `recordChronologicalCollectionSnapshot()` | `()` | Compute live value from collection + AGS rules, then record |
| `getValueHistory()` | `()` | All points (oldest→newest) |
| `getValueSummary()` | `()` | Latest value, peak, delta vs prior, points array |
| `getLifetimePeak()` | `()` | Peak + timestamp |
| `clearValueHistory()` | `()` | Wipe all history (debug) |

**Return Value** of `recordValueSnapshot()`:
```javascript
{
  today: number,          // Current value
  peak: number,           // Lifetime peak
  prevDay: number|null,   // Previous sample value
  delta: number,          // Change from prev (today - prevDay)
  isNewPeak: boolean      // Did we hit a new all-time high?
}
```

**Computation** (`recordChronologicalCollectionSnapshot`):
1. Load collection from `collectionManager.js`
2. Load market values from `marketValue.js`
3. Call `computeTotalCollectionValue()` with all context
4. Record snapshot via `recordValueSnapshot()`

---

## 3. Collection Valuation Logic

### File: [data/collectionValuation.js](artifacts/msge-lite/data/collectionValuation.js)

**Purpose**: Single authoritative line valuation (per-card market price + AGS graded premiums).

**Key Functions**:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `lineValueForCollectionEntry()` | `(setId, cardId, entry, ctx)` | Value of one collection entry |
| `computeTotalCollectionValue()` | `(collection, ctx)` | Sum across entire collection |

**Valuation Formula** (per card):
```
raw_copies = max(0, owned_count - ags_locked_copies)
raw_value = raw_copies * market_value
graded_value = sum(slab.grade.value for each slab of this card)
line_total = raw_value + graded_value
```

---

## 4. Market History & Price Graphs

### File: [data/marketHistory.js](artifacts/msge-lite/data/marketHistory.js)

**Purpose**: Per-card rolling price history for market trends UI.

**Storage Key**: `tcg_market_history`

**Storage Schema**:
```javascript
{
  [cardId]: [
    { t: timestamp, v: price },
    { t: timestamp, v: price },
    // ... max 30 points per card
  ]
}
```

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `appendHistory(cardId, value)` | Add new price point |
| `bulkAppendHistory(entries)` | Batch append (one localStorage write) |
| `getHistory(cardId)` | Get all points for card |
| `getMovementPct(cardId)` | % change first→last |
| `getRange(cardId)` | Min/max across history |
| `getVolatility(cardId)` | (max-min)/mean volatility metric |
| `seedInitialHistory(cardId, baseValue, tier)` | Generate 3-5 seed points for new cards |

---

## 5. Stats Screen — Timeline Graph + Archive Integration

### File: [main.js](artifacts/msge-lite/main.js) — `renderStatsScreen()` function (lines 3673–4130)

**Purpose**: Unified view of collection value trajectory + archive event markers with interactive storytelling.

### Visual Structure

```
┌─────────────────────────────────────────────────────────┐
│ Collector Rank Card (clickable → Collector Archive)    │
├─────────────────────────────────────────────────────────┤
│ Collection Prestige Card (progress bar + tier name)    │
├─────────────────────────────────────────────────────────┤
│ Collection Value Card (multi-section)                   │
│  ├─ Header: $today · change vs prior · lifetime peak   │
│  ├─ Timeline Graph (SVG)                               │
│  │   ├─ Area fill (gradient overlay)                   │
│  │   ├─ Path line (gold color)                         │
│  │   └─ Markers (clickable circles on archive events)  │
│  ├─ Archive Timeline (below graph)                      │
│  │   └─ Rows of archive entries (last 6 events)        │
│  └─ Hint (shows when < 3 data points)                  │
├─────────────────────────────────────────────────────────┤
│ Vendor Favor Grid (4 vendor favor bars)                 │
├─────────────────────────────────────────────────────────┤
│ Stats Grid (total cards, dupes, secret rares, etc.)    │
└─────────────────────────────────────────────────────────┘
```

### Timeline Graph Rendering

**SVG Path Construction** (lines 3977–4007):

1. **Data Preparation**:
   - Get value history: `const v = getValueSummary()`
   - Get recent archive entries: `const entries = getAllArchiveEntries().slice(0, 6).reverse()`
   - Filter to last 6 archive events for marker display

2. **Coordinate Scaling**:
   ```javascript
   const w = 400, h = 180;        // viewBox size
   const padX = 20, padY = 14;    // padding
   
   const points = pts.map((p, i) => {
     const x = padX + (i / (pts.length - 1)) * (w - padX * 2);
     const y = padY + ((1 - (p.value - min) / span)) * (h - padY * 2);
     return { x, y, value: p.value, ts: p.ts, day: p.day };
   });
   ```

3. **Path Generation**:
   ```javascript
   // Line path
   let path = '';
   points.forEach((pt, i) => {
     path += `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
   });
   
   // Area fill path (close the path under the line)
   const areaPath = `${path} L${w},${h} L0,${h} Z`;
   ```

4. **SVG Markup**:
   ```html
   <svg viewBox="0 0 400 180" preserveAspectRatio="none">
     <defs>
       <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="rgba(212,175,55,0.3)"/>
         <stop offset="100%" stop-color="rgba(212,175,55,0.0)"/>
       </linearGradient>
     </defs>
     <path class="stats-timeline-area" d="areaPath" fill="url(#timeline-grad)" />
     <path d="linePath" stroke="#D4AF37" stroke-width="2" fill="none" />
     <!-- Event markers -->
     ${markersSvg}
   </svg>
   ```

### Archive Event Markers

**Marker Rendering** (lines 3991–4006):

Each recent archive entry gets a marker circle on the graph IF the entry's timestamp is within the value history range.

```javascript
const markersSvg = recentEntries.map((entry, index) => {
  const nearest = points.reduce((best, pt) => {
    const diff = Math.abs(pt.ts - entry.ts);
    return !best || diff < best.diff ? { pt, diff } : best;
  }, null);
  
  if (!nearest || !nearest.pt) return '';
  
  const x = nearest.pt.x.toFixed(1);
  const y = nearest.pt.y.toFixed(1);
  const labelSafe = escapeSvgText(entry.label);
  
  return `
    <g class="stats-timeline-marker-group" 
       data-archive-index="${index}" 
       tabindex="0" 
       role="button">
      <circle class="stats-timeline-marker-hitarea" cx="${x}" cy="${y}" r="14" />
      <circle class="stats-timeline-marker" cx="${x}" cy="${y}" r="3.5" />
    </g>
  `;
}).join('');
```

### Interactive Timeline Events

**Event Binding** (lines 4107–4135):

```javascript
const markerGroups = Array.from(timelineCard.querySelectorAll('.stats-timeline-marker-group'));
const rowEls = Array.from(timelineCard.querySelectorAll('.stats-timeline-row'));

markerGroups.forEach((group) => {
  const index = Number(group.dataset.archiveIndex);
  
  // Single click handler
  const handler = () => activateArchiveIndex(index);
  
  // Wire all interaction patterns
  group.addEventListener('click', handler);
  group.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  });
  iosTap(group, handler);
});
```

**Active Row Update**:
```javascript
const setActiveArchive = (index) => {
  markerGroups.forEach((group) => {
    group.classList.toggle('is-active', Number(group.dataset.archiveIndex) === index);
  });
  rowEls.forEach((row) => {
    row.classList.toggle('is-active', Number(row.dataset.archiveIndex) === index);
  });
  // Update detail copy text
  if (detailCopy && rowEls[index]) {
    detailCopy.textContent = rowEls[index].querySelector('.stats-timeline-text')?.textContent;
  }
};
```

---

## 6. Market Screen — Card Price Graph Modal

### File: [ui/marketScreen.js](artifacts/msge-lite/ui/marketScreen.js)

**Purpose**: Interactive modal showing detailed price history for a single card with trend analysis.

**Files Involved**:
- `marketScreen.js` — List view + graph modal
- `marketHistory.js` — Price data source

### Graph Modal Rendering

**Initialization** (`openGraphModal` function, lines 233–310):

1. **Data Assembly**:
   ```javascript
   const history = getHistory(cardId);      // [{t, v}, ...]
   const move = getMovementPct(cardId);     // % change
   const range = getRange(cardId);          // {min, max}
   const vol = getVolatility(cardId);       // volatility metric
   ```

2. **Seed Check**:
   - If card has < 6 points and all are > 1 hour old → "seeded only" disclaimer
   - Seeded data is synthetic historical anchor, not real market ticks

3. **Large Chart SVG**:
   ```javascript
   largeChartSVG(history, 320, 140, move >= 0)
   ```

**Chart SVG Function** (`largeChartSVG`, lines 397–435):

```javascript
function largeChartSVG(history, w, h, isUp) {
  const padX = 8, padY = 12;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  
  if (history.length < 2) {
    // Flat reference line for single point
    return flatLineChart;
  }
  
  // Normalize values to SVG coordinates
  const vals = history.map(p => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = (max - min) || 1;
  
  // Build path
  let path = '';
  history.forEach((p, i) => {
    const x = padX + (i / (history.length - 1)) * innerW;
    const y = padY + (1 - (p.v - min) / span) * innerH;
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  
  // Return SVG with colored stroke (green if up, red if down)
  const stroke = isUp ? '#4ade80' : '#f87171';
  const fill = isUp ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.09)';
  
  return `
    <svg viewBox="0 0 ${w} ${h}" class="graph-svg">
      <path d="${path}" stroke="${stroke}" fill="none" stroke-width="2" />
      <path d="${path} L${w},${h} L0,${h} Z" fill="${fill}" />
    </svg>
  `;
}
```

### Tooltip Interaction

**Tooltip Wiring** (`wireGraphTooltip` function, lines 313–375):

Tracks mouse/touch position over graph to show value + date for nearest data point.

```javascript
function wireGraphTooltip(modal, history) {
  if (history.length < 2) return;
  
  const host = modal.querySelector('#graph-chart-host');
  const svg = host?.querySelector('svg.graph-svg');
  const tooltip = modal.querySelector('#graph-tooltip');
  
  // Create cursor line + dot elements in SVG
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  svg.appendChild(line); svg.appendChild(dot);
  
  // Mousemove/touchmove handler
  const move = (clientX) => {
    // Convert client X to SVG coordinates
    const rect = svg.getBoundingClientRect();
    const xRatio = (clientX - rect.left) / rect.width;
    const xPx = Math.max(0, Math.min(1, xRatio)) * w;
    
    // Find nearest data point
    let i = Math.round((xPx - padX) / step);
    i = Math.max(0, Math.min(history.length - 1, i));
    const pt = history[i];
    
    // Update cursor + tooltip
    const x = padX + i * step;
    const y = padY + (1 - (pt.v - min) / span) * innerH;
    
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    
    tooltip.innerHTML = `
      <span class="graph-tooltip-val">$${pt.v.toFixed(2)}</span>
      <span class="graph-tooltip-time">${formatDate(pt.t)}</span>
    `;
    tooltip.classList.add('is-visible');
  };
  
  // Attach listeners (mouse + touch)
  svg.addEventListener('mousemove', e => move(e.clientX));
  svg.addEventListener('mouseleave', () => tooltip.classList.remove('is-visible'));
  svg.addEventListener('touchmove', e => move(e.touches[0].clientX), {passive: true});
  svg.addEventListener('touchend', () => tooltip.classList.remove('is-visible'));
}
```

---

## 7. Probability Distribution Graph

### File: [ui/probabilityGraph.js](artifacts/msge-lite/ui/probabilityGraph.js)

**Purpose**: Chart.js-based rarity convergence graph showing actual vs theoretical pull rates.

**Data Tracked**:
```javascript
const history = {
  labels: [],       // Packs opened (x-axis)
  common: [],       // Actual %
  rare: [],         // Actual %
  epic: [],         // Actual %
  legendary: []     // Actual %
};
```

**Theoretical Expected Rates**:
- Common: ~78%
- Rare: ~17.6%
- Epic: ~3.96%
- Legendary: ~0.44%

**Update Pattern** (`updateGraph` function):
```javascript
export function updateGraph(rarityStats, totalCards, packsOpened) {
  if (!chart || totalCards === 0) return;
  
  const pct = (n) => parseFloat(((n / totalCards) * 100).toFixed(2));
  
  history.labels.push(packsOpened);
  history.common.push(pct(rarityStats.common));
  history.rare.push(pct(rarityStats.rare));
  history.epic.push(pct(rarityStats.epic));
  history.legendary.push(pct(rarityStats.legendary));
  
  // Trim to MAX_POINTS (200)
  if (history.labels.length > MAX_POINTS) {
    history.labels.shift();
    history.common.shift();
    history.rare.shift();
    history.epic.shift();
    history.legendary.shift();
  }
  
  chart.update();
}
```

---

## 8. Mobile Interaction Patterns

### iOS Touch Bypass Utility: `iosTap()`

**Location**: [main.js](artifacts/msge-lite/main.js) lines 2874–2903

**Problem**: iOS Safari sometimes fails to fire click events inside scrollable containers or on long pages.

**Solution**: Passive touch listener that suppresses synthetic click if finger didn't move.

```javascript
function iosTap(el, handler) {
  if (!el || DEBUG_FLAGS.noIosTap) return;
  
  let startX = 0, startY = 0, moved = false;
  
  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });
  
  el.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dx * dx + dy * dy > 64) moved = true;  // 8px threshold
  }, { passive: true });
  
  el.addEventListener('touchend', (e) => {
    if (!moved) {
      e.preventDefault();  // Suppress synthetic click → no double-fire
      handler();
    }
  }, { passive: false });
}
```

**Usage Across Timeline/Graph Systems**:
- Archive event markers: `iosTap(markerGroup, () => activateArchiveIndex(index))`
- Graph tooltip: Passive `touchmove` + `touchend` handlers
- Collector Archive back button: `iosTap(backBtn, closeCollectorArchive)`

### Scroll Lock for Modals

**Location**: [ui/overlayScrollLock.js](artifacts/msge-lite/ui/overlayScrollLock.js)

```javascript
function lockBodyScroll() { 
  document.body.style.overflow = 'hidden'; 
}
function unlockBodyScroll() { 
  document.body.style.overflow = ''; 
}
```

Used when opening:
- Stats screen
- Collector Archive
- Card detail modal
- Graph modal

---

## 9. State Management for Timeline/Archive/Graph

### Local State (no global state machine; localStorage-based)

| Module | Storage Key | State | Access Pattern |
|--------|------------|-------|-----------------|
| Archive History | `tcg_archive_history` | `{day0, entries[]}` | `load()` / `save()` |
| Value History | `tcg_value_history` | `{points[], lifetimePeak, lifetimePeakAt}` | `load()` / `save()` |
| Market History | `tcg_market_history` | `{[cardId]: [{t,v},...]}` | `load()` / `save()` |
| Vendor Timers | `rarebound_vendor_timers_v1` | `{[id]: {endsAt, label}}` | `_load()` / `_save()` |

### Event Consistency Mechanisms

1. **Recording Phase**:
   - `recordArchiveEvent()` immediately persists to localStorage
   - `recordValueSnapshot()` immediately persists to localStorage
   - Both are idempotent (safe to call multiple times)

2. **Rendering Phase**:
   - `renderStatsScreen()` calls `recordCollectionValueSnapshot()` BEFORE rendering
   - Ensures graph always reflects current state
   - Archive entries loaded fresh on each render

3. **Deduplication**:
   - Archive: `hasArchiveKey(key)` prevents re-recording same first-of-a-kind
   - Market: `seedInitialHistory()` bails if history already exists
   - Value: Value change threshold prevents duplicate samples

---

## 10. Data Consistency Between Systems

### Timeline Markers Match Archive Events

**Verification Logic**:
```javascript
// In renderStatsScreen(), after building the value graph:
const recentEntries = getAllArchiveEntries().slice(0, 6).reverse();

// For each entry, find nearest value point by timestamp
const nearest = points.reduce((best, pt) => {
  const diff = Math.abs(pt.ts - entry.ts);
  return !best || diff < best.diff ? { pt, diff } : best;
}, null);

// Only render marker if nearest point exists
if (nearest && nearest.pt) {
  // Render marker at (x, y) of nearest value point
}
```

### Collection Value Computation Consistency

**Three Callsites use identical logic**:

1. `recordChronologicalCollectionSnapshot()` — Value snapshot
2. `renderStatsScreen()` — Display total value
3. `lineValueForCollectionEntry()` — Per-card valuation

**Context Object Passed Everywhere**:
```javascript
const valCtx = {
  getCachedSetCards,
  allValues,
  getMarketValue,
  mapPokemonRarity,
};
computeTotalCollectionValue(collection, valCtx);
```

This ensures card prices, rarity mapping, and AGS premiums are consistent.

---

## 11. Event Filtering & Sorting Logic

### Archive Entry Filtering

**Location**: [data/archiveHistoryManager.js](artifacts/msge-lite/data/archiveHistoryManager.js)

```javascript
// Most recent N entries (default 6)
export function getArchiveEntries(limit = 6) {
  return load().entries.slice(0, limit);  // entries stored newest first
}

// All entries for full archive screen
export function getAllArchiveEntries() {
  return load().entries.slice();  // Read-only copy
}
```

**Filtering in Stats Screen**:
```javascript
const recentEntries = entries.slice(-6).reverse();  // Last 6, then reverse to chronological
```

### Value History Point Filtering

**Location**: [data/collectionValueHistory.js](artifacts/msge-lite/data/collectionValueHistory.js)

```javascript
// Load and coerce timestamps
const points = raw.points.map((p) => ({
  day:   typeof p.day === 'string' ? p.day : todayKey(),
  value: Number.isFinite(p.value) ? p.value : 0,
  ts: coerceTs(p),  // Validate/recover timestamp
})).sort((a, b) => a.ts - b.ts);  // Chronological order
```

### Market History Seeding & Trimming

**Location**: [data/marketHistory.js](artifacts/msge-lite/data/marketHistory.js)

```javascript
// Only seed if no history exists
export function seedInitialHistory(cardId, baseValue, tier = 'common') {
  const h = load();
  if (h[cardId]?.length) return;  // Already seeded
  
  // Generate 3-5 points spaced ~6h apart
  const arr = [];
  for (let i = 0; i < 5; i++) {
    arr.push({
      t: Date.now() - (5 - i) * 6 * 3600 * 1000,
      v: baseValue * (1 + jitter)
    });
  }
  h[cardId] = arr;
  save(h);
}

// Trim on append
export function appendHistory(cardId, value) {
  const h = load();
  const arr = h[cardId] || [];
  arr.push({ t: Date.now(), v: +value.toFixed(2) });
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  h[cardId] = arr;
  save(h);
}
```

---

## 12. File Inventory

### Core Data Modules

| File | Lines | Purpose |
|------|-------|---------|
| [data/archiveHistoryManager.js](artifacts/msge-lite/data/archiveHistoryManager.js) | 100 | Archive history persistence + query |
| [data/collectionValueHistory.js](artifacts/msge-lite/data/collectionValueHistory.js) | 175 | Value snapshot recording + retrieval |
| [data/collectionValuation.js](artifacts/msge-lite/data/collectionValuation.js) | 75 | Per-card + total collection valuation |
| [data/marketHistory.js](artifacts/msge-lite/data/marketHistory.js) | 160 | Per-card price history + analytics |

### UI/Rendering Modules

| File | Lines | Purpose |
|------|-------|---------|
| [main.js](artifacts/msge-lite/main.js) | ~4150 | Stats screen rendering + all event recording |
| [ui/marketScreen.js](artifacts/msge-lite/ui/marketScreen.js) | ~450 | Market list + graph modal |
| [ui/probabilityGraph.js](artifacts/msge-lite/ui/probabilityGraph.js) | ~200 | Chart.js rarity convergence graph |
| [ui/archiveServicesScreen.js](artifacts/msge-lite/ui/archiveServicesScreen.js) | ~550 | AGS/Archive Grading Services screen |

### Related Modules

| File | Purpose |
|------|---------|
| [data/activityFeed.js](artifacts/msge-lite/data/activityFeed.js) | Rolling activity log (separate from archive history) |
| [data/vendorTimers.js](artifacts/msge-lite/data/vendorTimers.js) | Countdown timers + tick subscriptions |
| [data/agsSubmissionManager.js](artifacts/msge-lite/data/agsSubmissionManager.js) | AGS slab tracking + archive integration |
| [ui/slabRenderer.js](artifacts/msge-lite/ui/slabRenderer.js) | CSS-based slab card rendering |

---

## 13. Known Issues & Technical Debt

### From ARCHITECTURE_NOTES.md

**Systems Approaching Instability**:
- **Pack opening** combines UI + animation + collection mutation + quality + milestones + history + reputation + vendor favor
- **AGS** requires physical-copy availability semantics (locked vs raw)
- **Requests** consume collection inventory + pay rewards across stores
- **main.js** size (~4150 lines) makes regression review expensive
- **style.css** mobile layering + modal polish increasingly complex

### Specific Technical Concerns

1. **Test Rendering** ([test-render.cjs](artifacts/msge-lite/test-render.cjs)):
   - Issue: `Math.min(...[])` returns `Infinity` if entries array is empty
   - Impact: Timeline graph coordinate calculation can break
   - Status: Unresolved in v1.7.0

2. **Archive Entry Sorting**:
   - Entries stored newest→oldest (`.unshift()`)
   - Stats screen reverses to chronological
   - Risk: Off-by-one errors in pagination

3. **Value History Migration**:
   - v1.4.0 stored 1 point/day; v1.7.0 stores up to 200
   - Migration code normalizes old format on load
   - Risk: Precision loss if load/save cycle breaks

---

## 14. Interaction Patterns Summary

### User Interactions with Timeline/Graph

1. **View Stats Screen**: Click "Stats" button
   - Calls `openStatsScreen()` → `renderStatsScreen()`
   - Loads archive entries + value history
   - Renders graph + markers

2. **Click Archive Marker**: Tap circle on graph
   - `activateArchiveIndex(index)` highlights marker + corresponding row
   - Updates detail text below graph
   - Mobile: `iosTap()` ensures click fires

3. **View Collector Archive**: Click rank card
   - `openCollectorArchive()` → `renderCollectorArchive()`
   - Shows rank progression timeline + milestones
   - Back button: `iosTap()` + `unlockBodyScroll()`

4. **View Market Graph**: Click card → "View" in modal
   - `openGraphModal(cardId)` renders large SVG chart
   - Hover/touch: `wireGraphTooltip()` shows value + date
   - Mobile: `touchmove` + `touchend` handlers

5. **Snapshot Recording** (automatic):
   - Pack opened: `recordCollectionValueSnapshot()`
   - Archive event: `recordArchiveEvent(type, label, {key?, meta?})`
   - Both persist immediately to localStorage

---

## 15. Testing & Validation Checklist

- [ ] Archive entries deduplicate correctly by key
- [ ] Value history respects UTC day boundaries
- [ ] Material move threshold ($25 / 1%) triggers correctly
- [ ] Graph coordinate scaling handles empty/single-point history
- [ ] Archive markers align with value points temporally
- [ ] Timeline zoom/pan works on mobile (none currently)
- [ ] Tooltip follows cursor on touch
- [ ] Graph modal closes without memory leaks
- [ ] Value snapshot called after pack opening
- [ ] Prestige pulls archive correctly
- [ ] Set completion archives once per set
- [ ] Value milestone dedupes by bracket
- [ ] Stats screen re-renders when archive changes
- [ ] Market history seeding is idempotent

---

## References

- Architecture Notes: [ARCHITECTURE_NOTES.md](../ARCHITECTURE_NOTES.md)
- Save Schema: [docs/SAVE_SCHEMA.md](artifacts/msge-lite/docs/SAVE_SCHEMA.md)
- Tech Debt: [TECH_DEBT.md](../TECH_DEBT.md)
