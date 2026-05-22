const v = { delta: 100, points: [{ts: Date.now() - 50000, value: 50}, {ts: Date.now(), value: 100}] };
const entries = [{ts: Date.now() - 20000, label: "Test event"}];
let pts = v.points.slice();
if (pts.length === 0) {
    pts = [{ ts: Date.now() - 1000, value: 0 }, { ts: Date.now(), value: 0 }];
} else if (pts.length === 1) {
    pts = [{ ts: pts[0].ts - 86400000, value: pts[0].value }, pts[0]];
}

const maxTs = Date.now();
// The issue might be here: if entries is empty, ...entries.map() spreads [], Math.min(...[]) is Infinity
console.log("entries length:", entries.length);
console.log("pts mapped:", pts.map(p => p.ts));
console.log("entries mapped:", entries.map(e => e.ts));
const minTs = Math.min(...pts.map(p => p.ts), ...entries.map(e => e.ts), maxTs - 86400000);
console.log("minTs:", minTs, "maxTs:", maxTs);

const tsSpan = Math.max(1, maxTs - minTs);

const maxV = Math.max(...pts.map(p => p.value), 1);
const minV = Math.min(...pts.map(p => p.value));
const spanV = Math.max(1, maxV - minV);
const padV = spanV * 0.15;

const w = 400, h = 120; // WAIT! viewBox uses 400x120 but the layout CSS changed height to 180! This might be a mismatch but not a break.
const scaleX = (ts) => ((ts - minTs) / tsSpan) * w;
const scaleY = (val) => h - ((val - minV + padV) / (spanV + padV * 2)) * h;

let path = '';
pts.forEach((p, i) => {
    path += `${i === 0 ? 'M' : 'L'}${scaleX(p.ts).toFixed(1)},${scaleY(p.value).toFixed(1)} `;
});
console.log('Path:', path);
