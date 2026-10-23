/* W7: 跑 N 帧后打印决策日志里与"猎雁"相关的条目(诊断 tryDash 是否被否决)。
 * 用法: node _wip/w7_log.mjs <html> <frames> <seed> [过滤串] */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || "掠食竞赛.html";
const FR = Number(process.argv[3] || 4000);
const SEED = Number(process.argv[4] || 101);
const FILT = process.argv[5] || "猎雁";
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
const seen = [];
for (let f = 1; f <= FR; f++) {
  SIM.step();
  const tail = SIM.logTail(12);
  for (const e of tail) if (e.msg.includes(FILT) && !seen.some(s => s.frame === e.frame && s.msg === e.msg)) seen.push(e);
}
console.log(`frames=${FR} seed=${SEED} 过滤="${FILT}" 命中 ${seen.length} 条`);
const counts = {};
for (const e of seen) { const key = e.kind + "|" + e.msg.replace(/#\d+/g, "#").replace(/[\d.]+/g, "N"); counts[key] = (counts[key] || 0) + 1; }
for (const k of Object.keys(counts).sort((a, b) => counts[b] - counts[a])) console.log(`  ${counts[k]}x  ${k.slice(0, 200)}`);
console.log("---- 前 12 条原文 ----");
for (const e of seen.slice(0, 12)) console.log(`  f${e.frame} [${e.kind}] ${e.who} ${e.msg}`);
console.log(`stats: gooseTargetFrames=${SIM.stats.falconGooseTargetFrames} gooseKills=${SIM.stats.falconGooseKills} dashFrames=${SIM.stats.falconDashFrames} missFalcon=${SIM.stats.missFalcon}`);
