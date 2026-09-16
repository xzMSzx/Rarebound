function uid(){return Math.random().toString(36).slice(2,10)}
function snapshot(){return JSON.stringify({objects:state.objects,targets:state.targets,plan:state.plan,settings:state.settings,view:state.view})}
function restore(s){const o=JSON.parse(s);state.objects=o.objects||[];state.targets=o.targets||[];state.plan=o.plan||[];state.settings={...state.settings,...(o.settings||{})};state.view={...state.view,...(o.view||{})};routeStats=null;syncSettings();render();autosave()}
function pushHistory(){state.history.push(snapshot());if(state.history.length>60)state.history.shift();state.future=[]}
function undo(){if(!state.history.length)return;state.future.push(snapshot());restore(state.history.pop())}function redo(){if(!state.future.length)return;state.history.push(snapshot());restore(state.future.pop())}
function autosave(){try{localStorage.setItem('tntTerritoryOptimizer',snapshot())}catch(e){}}
function loadAuto(){try{const s=localStorage.getItem('tntTerritoryOptimizer');if(s)restore(s)}catch(e){}}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2400)}
function rectFor(o){const r=o.type==='hq'?state.settings.hqRadius:state.settings.bannerRadius;const size=o.type==='hq'?3:1;return{x1:o.x-r,y1:o.y-r,x2:o.x+size+r,y2:o.y+size+r}}
function overlapOrTouch(a,b){return a.x1<=b.x2&&a.x2>=b.x1&&a.y1<=b.y2&&a.y2>=b.y1}
function overlap(a,b){return a.x1<b.x2&&a.x2>b.x1&&a.y1<b.y2&&a.y2>b.y1}
function fzone(s){const [x,y,sz,fz]=s;return{x1:Math.round(x+sz/2-fz/2),y1:Math.round(y+sz/2-fz/2),x2:Math.round(x+sz/2-fz/2)+fz,y2:Math.round(y+sz/2-fz/2)+fz}}
function zoneContains(name,x,y,size=1){const z=ZONES[name];return x<z.x2+1&&x+size>z.x1&&y<z.y2+1&&y+size>z.y1}
function terrainAtGame(x,y){if(!terrain)return 0;const iy=GRID-1-y; if(x<0||x>=GRID||iy<0||iy>=GRID)return 0;return terrain[iy*GRID+x]||0}
function blockReason(type,x,y){const size=type==='hq'?3:1;if(x<0||y<0||x+size>GRID||y+size>GRID)return'Outside kingdom map';const rr={x1:x,y1:y,x2:x+size,y2:y+size};if(overlap(rr,KING_ZONE))return"King's Castle exclusion zone";for(const s of STRUCTS){const sr={x1:s[0],y1:s[1],x2:s[0]+s[2],y2:s[1]+s[2]};if(overlap(rr,sr))return'Permanent facility footprint';}
for(let yy=y;yy<y+size;yy++)for(let xx=x;xx<x+size;xx++){const t=terrainAtGame(xx,yy);if(t)return t>=3?'Alliance resource node':'Mountain/lake terrain'}
if(zoneContains('ruins',x,y,size))return'Ruins zone blocks alliance buildings';if(type==='hq'&&(zoneContains('fertile',x,y,size)||zoneContains('forbidden',x,y,size)))return'HQ only allowed in Badlands / Plains';if(zoneContains('forbidden',x,y,size))return'Forbidden ring';for(const s of STRUCTS){if(overlap(rr,fzone(s)))return`${s[8]} no-build zone`;}return null}
