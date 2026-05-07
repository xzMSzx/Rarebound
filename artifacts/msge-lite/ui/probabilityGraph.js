/**
 * ui/probabilityGraph.js
 * Chart.js probability convergence graph.
 *
 * Plots actual rarity drop rates over time so you can watch them
 * converge toward (or diverge from) the theoretical expected values.
 *
 * Depends on Chart.js being loaded globally via the CDN <script> tag in index.html.
 */

// Theoretical expected rates calculated from the slot probability tables:
//   Slots 1-3 → always Common (3 cards per pack)
//   Slot 4    → Rare 80%, Epic 18%, Legendary 2%
//   Slot 5    → Common 90%, Rare 8%, Epic 1.8%, Legendary 0.2%
// Per-card averages: Common ≈78%, Rare ≈17.6%, Epic ≈3.96%, Legendary ≈0.44%
const EXPECTED = { common: 78.0, rare: 17.6, epic: 3.96, legendary: 0.44 };

const LINE_COLORS = {
  common:    'rgba(160, 160, 160, 0.9)',
  rare:      'rgba(74,  158, 255, 0.9)',
  epic:      'rgba(196, 122, 255, 0.9)',
  legendary: 'rgba(255, 207,  64, 0.9)',
};

// Snapshot history for graph data points (trimmed to MAX_POINTS)
const MAX_POINTS = 200;
const history = { labels: [], common: [], rare: [], epic: [], legendary: [] };

let chart = null;

/**
 * Make a dashed-line reference dataset for an expected value.
 */
function expectedDataset(label, color, value) {
  return {
    label: `${label} (expected)`,
    data: [],            // filled lazily on each update
    borderColor: color,
    borderDash: [4, 4],
    borderWidth: 1,
    backgroundColor: 'transparent',
    pointRadius: 0,
    tension: 0,
  };
}

/**
 * Initialise the Chart.js chart on #probability-chart.
 * Call once after the DOM is ready.
 */
export function initGraph() {
  const canvas = document.getElementById('probability-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: history.labels,
      datasets: [
        {
          label: 'Common',
          data: history.common,
          borderColor: LINE_COLORS.common,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Rare',
          data: history.rare,
          borderColor: LINE_COLORS.rare,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Epic',
          data: history.epic,
          borderColor: LINE_COLORS.epic,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Legendary',
          data: history.legendary,
          borderColor: LINE_COLORS.legendary,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#777',
            font: { family: 'Courier New', size: 10 },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: '#aaa',
          bodyColor: '#888',
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#555',
            font: { family: 'Courier New', size: 9 },
            maxTicksLimit: 6,
          },
          grid: { color: '#1e1e1e' },
          title: {
            display: true,
            text: 'Packs Opened',
            color: '#555',
            font: { size: 9, family: 'Courier New' },
          },
        },
        y: {
          ticks: {
            color: '#555',
            font: { family: 'Courier New', size: 9 },
            callback: (v) => v + '%',
          },
          grid: { color: '#1e1e1e' },
          title: {
            display: true,
            text: 'Drop Rate %',
            color: '#555',
            font: { size: 9, family: 'Courier New' },
          },
          suggestedMin: 0,
          suggestedMax: 90,
        },
      },
    },
  });
}

/**
 * Push a new data point and refresh the chart.
 *
 * @param {Object} rarityStats  - engine.state.rarityStats
 * @param {number} totalCards
 * @param {number} packsOpened
 */
export function updateGraph(rarityStats, totalCards, packsOpened) {
  if (!chart || totalCards === 0) return;

  const pct = (n) => parseFloat(((n / totalCards) * 100).toFixed(2));

  history.labels.push(packsOpened);
  history.common.push(pct(rarityStats.common));
  history.rare.push(pct(rarityStats.rare));
  history.epic.push(pct(rarityStats.epic));
  history.legendary.push(pct(rarityStats.legendary));

  // Keep the history array bounded
  if (history.labels.length > MAX_POINTS) {
    history.labels.shift();
    history.common.shift();
    history.rare.shift();
    history.epic.shift();
    history.legendary.shift();
  }

  chart.update();
}

/**
 * Clear all history and reset the chart (call on simulation reset).
 */
export function resetGraph() {
  history.labels.length = 0;
  history.common.length = 0;
  history.rare.length = 0;
  history.epic.length = 0;
  history.legendary.length = 0;
  if (chart) chart.update();
}
