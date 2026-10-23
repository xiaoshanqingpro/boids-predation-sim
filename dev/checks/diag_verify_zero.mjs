/* verifier(task-5) 独立复现: 世界放大到 3200x2200 后"总捕获 0"的根因取证
 * 用法: node _checks\diag_verify_zero.mjs [html] [frames]
 * 输出: 猛禽出生点 / 鸟群质心 / 两者距离随帧变化 / 每次冲刺的锁定情况 */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || process.env.SIM_HTML || "掠食竞赛.html";
const FRAMES = Number(process.argv[3] || 3000);
const html = fs.readFileSync(HTML, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
if (!SIM) { console.log("NO SIM HOOK"); process.exit(2); }
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
const wi = SIM.worldInfo ? SIM.worldInfo() : null;
console.log("worldInfo=" + JSON.stringify(wi));
console.log("raptorCount=" + JSON.stringify(SIM.raptorCount));
const centroidS = () => { let sx = 0, sy = 0, c = 0; for (let i = 0; i < SIM.N; i++) { const b = SIM.starling(i); if (b.alive) { sx += b.x; sy += b.y; c++; } } return c ? { x: sx / c, y: sy / c, n: c } : null; };
const centroidG = () => { let sx = 0, sy = 0, c = 0; for (let i = 0; i < 60; i++) { const b = SIM.goose(i); if (b.alive) { sx += b.x; sy += b.y; c++; } } return c ? { x: sx / c, y: sy / c, n: c } : null; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunter(k); console.log(`  raptor[${k}] 出生 (${h.x.toFixed(0)},${h.y.toFixed(0)},z=${h.z.toFixed(0)}) energy=${h.energy.toFixed(0)}`); }
const rc0 = centroidS(); console.log("鸟群出生质心 " + (rc0 ? `(${rc0.x.toFixed(0)},${rc0.y.toFixed(0)})` : "-") + "  雁群 " + JSON.stringify(centroidG()));
let lastDash = {}; let dashStarts = 0, eatsInDash = 0, locksInDash = 0, dashNoLock = 0;
for (let f = 0; f < FRAMES; f++) {
  SIM.step();
  for (let k = 0; k < SIM.raptorCount.total; k++) {
    const h = SIM.hunter(k);
    if (h.dashT > 0 && !lastDash[k]) { dashStarts++; if (h.lockIdx < 0) dashNoLock++; }
    else if (h.dashT > 0) { if (h.lockIdx >= 0) locksInDash++; }
    lastDash[k] = h.dashT > 0;
  }
  if (f % 500 === 0 || f === FRAMES - 1) {
    const cs = centroidS(), cg = centroidG();
    const ds = []; for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunter(k); ds.push(cs ? dist(h, cs).toFixed(0) : "-"); }
    const w2 = SIM.worldInfo ? SIM.worldInfo() : {};
    console.log(`f${f}: 鸟质心(${cs ? cs.x.toFixed(0) : "-"},${cs ? cs.y.toFixed(0) : "-"}) n=${cs ? cs.n : 0} | 雁质心(${cg ? cg.x.toFixed(0) : "-"},${cg ? cg.y.toFixed(0) : "-"}) | 猛禽->鸟质心 距离=${ds.join("/")} | kills=${SIM.kills.join("/")} diet=${SIM.diet.join("/")} | clampCount=${w2.clampCount} peak=${w2.peakPenetration && w2.peakPenetration.toFixed(3)} minEdge=${w2.minEdgeDist === null ? "null" : w2.minEdgeDist.toFixed(1)}`);
  }
}
console.log(`总捕获 ${SIM.kills.reduce((a, b) => a + b, 0)} / 冲刺 ${dashStarts} 次; 冲刺中无锁定帧 ${dashNoLock} (起始时) ; 得分=${SIM.scores.join("/")}`);
