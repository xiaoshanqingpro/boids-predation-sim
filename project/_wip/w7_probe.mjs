/* W7 定种子口径的得分效率探针(与 _probe_score.mjs 同口径, 但可复现 + 加分物种/冲刺计数)
 * 用法: node _wip/w7_probe.mjs <html> <frames> <seed> [tag]
 * 输出: 一行 JSON + 人类可读表。 */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || "掠食竞赛.html";
const FR = Number(process.argv[3] || 12000);
const SEED = Number(process.argv[4] || 101);
const TAG = process.argv[5] || "";
const html = fs.readFileSync(HTML, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
const sb = { document: d, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console, navigator: {}, location: { search: "" }, addEventListener() {}, removeEventListener() {} };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(`(function(){ let a = ${SEED | 0} >>> 0; Math.random = function () {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}; })();`, sb);
vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
SIM.addGhunter && SIM.addGhunter();

const total = SIM.raptorCount.total;
const snap = () => {
  const o = [];
  for (let k = 0; k < total; k++) {
    const h = SIM.hunterDetail(k) || SIM.hunter(k);
    o.push({ kind: h.kind, label: h.label, score: h.score, kills: h.kills,
             dietGoose: h.dietGoose || 0, dietStarling: h.dietStarling || 0,
             hitGoose: h.hitGoose || 0, hitStarling: h.hitStarling || 0,
             attacks: h.attacks || 0 });
  }
  return o;
};
const A = snap();
let gooseAliveMin = 1e9, gooseAliveEnd = 0, starAliveEnd = 0, maxLiveDashFrames = 0;
const dashes = new Array(total).fill(0), dashGoose = new Array(total).fill(0), dashStar = new Array(total).fill(0);
const prevDash = new Array(total).fill(false), prevVel = new Array(total).fill(null);
let maxAng = 0, nAng = 0, sumAng = 0, outFrames = 0, clamp0 = 0;
const wi = SIM.worldInfo();
const prevKills = new Array(total).fill(0), prevScore = new Array(total).fill(0);
for (let i = 0; i < FR; i++) {
  SIM.step();
  for (let k = 0; k < total; k++) {
    const h = SIM.hunterDetail(k) || SIM.hunter(k);
    const inDash = (h.dashT || 0) > 0;
    if (inDash && !prevDash[k]) {
      dashes[k]++;
      if (Number.isFinite(h.dashAng) && h.dashAng > 0) { const a = h.dashAng * 180 / Math.PI; if (a > maxAng) maxAng = a; sumAng += a; nAng++; }
    }
    if (inDash && (h.dashT || 0) > maxLiveDashFrames) maxLiveDashFrames = h.dashT;
    prevDash[k] = inDash;
  }
  const w2 = SIM.worldInfo();
  if (i % 25 === 0) {
    let ga = 0; for (let j = 0; j < SIM.M; j++) if (SIM.goose(j).alive) ga++;
    if (ga < gooseAliveMin) gooseAliveMin = ga;
    gooseAliveEnd = ga;
    let sa = 0; for (let j = 0; j < SIM.N; j++) if (SIM.starling(j).alive) sa++;
    starAliveEnd = sa;
    clamp0 = w2.clampCount;
  }
  for (let k = 0; k < total; k++) { const h = SIM.hunter(k); if (h.x < 0 || h.x > w2.worldW || h.y < 0 || h.y > w2.worldH) outFrames++; }
}
const B = snap();
const mins = FR / 60 / 60;
const rows = [];
for (let k = 0; k < total; k++) {
  const a = A[k], b = B[k];
  const dS = b.score - a.score, dK = b.kills - a.kills;
  const dG = b.dietGoose - a.dietGoose, dStar = b.dietStarling - a.dietStarling;
  rows.push({ k, kind: b.kind, label: b.label, score: b.score, kills: b.kills,
    sPerMin: +(dS / mins).toFixed(1), killsPerMin: +(dK / mins).toFixed(1),
    perKill: dK ? +(dS / dK).toFixed(2) : null, perDash: dashes[k] ? +(dS / dashes[k]).toFixed(2) : null,
    dashes: dashes[k], dGoose: dG, dStarling: dStar, attacks: b.attacks });
}
const sum = f => rows.reduce((s, r) => s + f(r), 0);
const out = {
  tag: TAG, html: HTML, frames: FR, seed: SEED,
  totalKills: SIM.stats.kills,
  falconScore: sum(r => r.kind === "falcon" ? r.sPerMin : 0),
  falconPerKill: (() => { const dS = rows.filter(r => r.kind === "falcon").reduce((s, r) => s + (r.score), 0); return null; })(),
  gooseAliveMin, gooseAliveEnd, starAliveEnd,
  missFalcon: SIM.stats.missFalcon, lockedDashes: SIM.stats.lockedDashes,
  clashes: SIM.stats.clashes, steals: SIM.stats.steals,
  falconGooseKills: SIM.stats.falconGooseKills || 0, falconGooseTargetFrames: SIM.stats.falconGooseTargetFrames || 0,
  falconDashFrames: SIM.stats.falconDashFrames || 0, falconHuntScore: SIM.stats.falconHuntScore || 0,
  ghunterAttacks: SIM.stats.ghunterAttacks, ghunterGoose: SIM.stats.ghunterGoose,
  ghunterStarling: SIM.stats.ghunterStarling, ghunterMiss: SIM.stats.ghunterMiss,
  maxDashAng: +maxAng.toFixed(2), meanDashAng: nAng ? +(sumAng / nAng).toFixed(2) : null,
  clampCount: clamp0, maxLiveDashFrames,
  rows,
};
console.log(JSON.stringify(out));
if (TAG !== "-q") {
  console.log(`== ${TAG} ${HTML} frames=${FR} seed=${SEED}`);
  console.log("kind      label   score kills  分/分钟  分/次杀  分/冲刺 冲刺  雁杀 鸟杀  攻击");
  for (const r of rows) console.log(`${r.kind.padEnd(9)} ${String(r.label).padEnd(6)} ${String(r.score).padStart(5)} ${String(r.kills).padStart(5)} ${String(r.sPerMin).padStart(8)} ${String(r.perKill).padStart(8)} ${String(r.perDash).padStart(8)} ${String(r.dashes).padStart(4)} ${String(r.dGoose).padStart(5)} ${String(r.dStarling).padStart(5)} ${String(r.attacks).padStart(5)}`);
  console.log(`总捕获=${SIM.stats.kills} 空冲刺=${SIM.stats.missFalcon} 锁定冲刺=${SIM.stats.lockedDashes} 雁存活min=${gooseAliveMin} end=${gooseAliveEnd} 椋鸟存活end=${starAliveEnd}`);
  console.log(`雁隼: attacks=${SIM.stats.ghunterAttacks} goose=${SIM.stats.ghunterGoose} starling=${SIM.stats.ghunterStarling} miss=${SIM.stats.ghunterMiss}`);
  console.log(`dashAng max=${maxAng.toFixed(2)}° mean=${nAng ? (sumAng / nAng).toFixed(2) : "-"}° n=${nAng} clamp=${clamp0} 越界帧=${outFrames} 最长冲刺=${maxLiveDashFrames}帧`);
  console.log(`W7: 隼猎雁杀=${SIM.stats.falconGooseKills || 0} 雁当选目标帧=${SIM.stats.falconGooseTargetFrames || 0} 隼冲刺总帧=${SIM.stats.falconDashFrames || 0} 隼净猎获分=${SIM.stats.falconHuntScore || 0}`);
}
