const fs = require('fs');
let code = fs.readFileSync('artifacts/msge-lite/main.js', 'utf8');

const importSearch = `import { recordArchiveEvent, logActivity } from './data/marketHistory.js';`;
const importReplace = `import { recordArchiveEvent, logActivity } from './data/marketHistory.js';
import { suspendAmbientAudio, resumeAmbientAudio } from './data/ambientAudioManager.js';
import { suspendSFXAudio, resumeSFXAudio } from './ui/audioManager.js';`;

code = code.replace(importSearch, importReplace);


const tickSearch = `renderRecentHits();

// Live tick — refresh strip every 30s; check for cycle rollover, advance chase timer
setInterval(() => {`;
const tickReplace = `renderRecentHits();

// Phase 10.5 — Visibility API to pause audio & heavy background logic when tab is hidden
let _isBackgrounded = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _isBackgrounded = true;
      suspendAmbientAudio();
      suspendSFXAudio();
    } else {
      _isBackgrounded = false;
      resumeAmbientAudio();
      resumeSFXAudio();
      // Re-trigger live tick manually on return to catch up instantly
      if (typeof _liveTick === 'function') {
        _liveTick();
      }
    }
  });
}

// Live tick — refresh strip every 30s; check for cycle rollover, advance chase timer
function _liveTick() {
  if (_isBackgrounded) return; // Skip work while tab is suspended`;

// Use simple indexOf to make sure we replace the correct one
const index = code.indexOf(tickSearch);
if (index !== -1) {
    code = code.slice(0, index) + tickReplace + code.slice(index + tickSearch.length);
}

const tickEndSearch = `  updateMarketStrip();
  renderStipendStrip();
  renderChaseStrip();
}, 30 * 1000);`;
const tickEndReplace = `  updateMarketStrip();
  renderStipendStrip();
  renderChaseStrip();
}
setInterval(_liveTick, 30 * 1000);`;

code = code.replace(tickEndSearch, tickEndReplace);

fs.writeFileSync('artifacts/msge-lite/main.js', code);
