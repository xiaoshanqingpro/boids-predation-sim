/* W7 诊断: 隼"猎雁冲刺"的命中过程 —— 每次雁冲刺记录 初始/最小水平距离、迟到多少帧、是否吃到。
 * 用法: node _wip/w7_goosediag.mjs <html> <frames> <seed> */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || "掠食竞赛.html";
const FR = Number(process.argv[3] || 4000);
const SEED = Number(process.argv[4] || 101);
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
const falconIdx = [];
for (let k = 0; k < total; k++) if (SIM.hunterDetail(k).kind === "falcon") falconIdx.push(k);
const events = [];
const cur = new Map();
const stat = {};
for (const k of falconIdx) stat[k] = { tgt: 0, ready: 0, readyActive: 0, dash: 0, gooseDash: 0, gInView: 0, gInViewActive: 0, gInViewReadyActive: 0 };
let gooseStartAlive = 0; for (let j = 0; j < SIM.M; j++) if (SIM.goose(j).alive) gooseStartAlive++;
for (let f = 1; f <= FR; f++) {
  SIM.step();
  const activeId = (SIM.raptorRefs && SIM.raptorRefs().activeId);
  for (const k of falconIdx) {
    const h = SIM.hunterDetail(k);
    const inDash = (h.dashT || 0) > 0;
    const g = h.lockGoose;
    const isActive = k === activeId;
    if ((h.tgtGoose | 0) >= 0) { stat[k].tgt++; if (!inDash && (h.circleT || 0) <= 0 && (h.stun || 0) <= 0) { stat[k].ready++; if (isActive) stat[k].readyActive++; } }
    // 结构诊断: 该隼巡航时"视野内最近雁"的距离分布(不看权重) + 是否处在可出手的盘旋期满状态
    if (!inDash) {
      let gmin = 1e9; for (let j = 0; j < SIM.M; j++) { const gg = SIM.goose(j); if (!gg.alive) continue; const dd = Math.hypot(gg.x - h.x, gg.y - h.y); if (dd < gmin) gmin = dd; }
      if (gmin < 380) { stat[k].gInView++; if ((h.circleT || 0) <= 0 && isActive) stat[k].gInViewReadyActive++; }
      if (gmin < 380 && isActive) stat[k].gInViewActive++;
    }
    if (inDash && !cur.has(k)) { stat[k].dash++; if ((g | 0) >= 0) stat[k].gooseDash++; }
    if (inDash && (g | 0) >= 0 && !cur.has(k)) {
      const gg = SIM.goose(g);
      cur.set(k, { f0: f, goose: g, d0: Math.hypot(gg.x - h.x, gg.y - h.y), dmin: 1e9, frames: 0, ate: 0, killed0: h.kills, alive1: gg.alive, z0: h.z, gz: gg.z });
    }
    const c = cur.get(k);
    if (c) {
      const gg = SIM.goose(c.goose);
      const dd = gg.alive ? Math.hypot(gg.x - h.x, gg.y - h.y) : 0;
      if (gg.alive && dd < c.dmin) c.dmin = dd;
      c.frames++;
      if (!gg.alive) { c.ate = 1; c.alive1 = false; }
      if (!inDash) {
        c.kills1 = h.kills;
        c.ate = c.ate || (h.kills > c.killed0 ? 1 : 0);
        events.push(c); cur.delete(k);
      }
    }
  }
}
for (const c of cur.values()) { const h = SIM.hunterDetail(0); events.push(c); }
const goose = events;
const n = goose.length;
const ate = goose.filter(e => e.ate).length;
const sorted = a => a.slice().sort((x, y) => x - y);
const q = (a, p) => a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
const d0 = goose.map(e => e.d0), dmin = goose.map(e => e.dmin), fr = goose.map(e => e.frames);
console.log(JSON.stringify({ html: HTML, frames: FR, seed: SEED,
  gooseDashes: n, caught: ate, catchRate: n ? +(ate / n).toFixed(3) : null,
  d0_med: +q(d0, 0.5).toFixed(0), d0_max: +Math.max(...d0, 0).toFixed(0),
  dmin_med: +q(dmin, 0.5).toFixed(1), dmin_min: +Math.min(...dmin, 1e9).toFixed(1),
  frames_med: q(fr, 0.5), frames_max: Math.max(...fr, 0),
  gooseKills: SIM.stats.falconGooseKills, gooseTargetFrames: SIM.stats.falconGooseTargetFrames,
  gooseStartAlive, gooseEndAlive: (() => { let a = 0; for (let j = 0; j < SIM.M; j++) if (SIM.goose(j).alive) a++; return a; })(),
  ghunterGoose: SIM.stats.ghunterGoose, perFalcon: stat }));
console.log("raptorRefs:", JSON.stringify(SIM.raptorRefs ? SIM.raptorRefs() : "NO_HOOK"));
const show = goose.slice(0, 25).map(e => `f${e.f0} 雁#${e.goose} d0=${e.d0.toFixed(0)} dmin=${e.dmin.toFixed(1)} 帧=${e.frames} 吃到=${e.ate} dz=${(e.gz - e.z0).toFixed(0)}`);
console.log(show.join("\n"));
