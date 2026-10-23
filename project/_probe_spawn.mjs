/* 只读诊断: 世界放大到 3200×2200 后, 猛禽/雁与鸟群的相对位置随时间怎么变 */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2] || "掠食竞赛.html", "utf8");
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
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
const wi = SIM.worldInfo();
const flock = () => { let x = 0, y = 0, c = 0; for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) { x += s.x; y += s.y; c++; } } return { x: x / c, y: y / c, c }; };
const f0 = flock();
console.log(`世界 ${wi.worldW}×${wi.worldH}; 鸟群质心 初始 (${f0.x.toFixed(0)},${f0.y.toFixed(0)}) n=${f0.c}`);
const rows = [];
for (let f = 1; f <= 3000; f++) {
  SIM.step();
  if (f === 1 || f === 30 || f === 120 || f === 400 || f === 1000 || f === 2000 || f === 3000) {
    const fl = flock();
    const info = [];
    for (let k = 0; k < SIM.raptorCount.total; k++) {
      const h = SIM.hunter(k);
      info.push(`${h.kind}(${h.x.toFixed(0)},${h.y.toFixed(0)}) d=${Math.hypot(h.x - fl.x, h.y - fl.y).toFixed(0)} dash=${h.dashT > 0 ? 1 : 0} ky=${(h.kills || 0)}`);
    }
    rows.push(`f${String(f).padStart(4)} 鸟群(${fl.x.toFixed(0)},${fl.y.toFixed(0)}) | ` + info.join(" | ") + ` | 总捕获 ${SIM.kills.reduce((a, b) => a + b, 0)}`);
  }
}
console.log(rows.join("\n"));
// 猛禽在这段里被边界力影响的次数(用峰值侵入 + 到边界的最近距离估计)
const w2 = SIM.worldInfo();
console.log(`边界统计: clamp=${w2.clampCount} peak=${w2.peakPenetration.toFixed(2)} minEdge=${w2.minEdgeDist && w2.minEdgeDist.toFixed(0)}`);
