/* 性能分解(不改主文件): 用 N 缩放把 step 时间拆成"固定开销 + 每只鸟开销",
 * 再对"世界尺寸"做消融, 看 1.38× 到底来自桶数(固定项)还是邻居搜索(每只鸟项)。
 * 用法: node _wip/perf_split.mjs <html> <N> [帧数] */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || "掠食竞赛.html";
const N = Number(process.argv[3] || 2000);
const FR = Number(process.argv[4] || 400);
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
SIM.setGeometry(false); SIM.setN(N); SIM.setGravity(true); SIM.setRefill(false);
const wi = SIM.worldInfo();
let best = 1e9;
for (let rep = 0; rep < 3; rep++) {
  if (rep) { SIM.setGeometry(false); SIM.setN(N); SIM.setGravity(true); SIM.setRefill(false); }
  for (let i = 0; i < 120; i++) SIM.step();           // 预热
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < FR; i++) SIM.step();
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6 / FR;
  if (ms < best) best = ms;
}
console.log(`${HTML} N=${N} 世界=${wi.worldW}x${wi.worldH} 桶数=${(Math.ceil((wi.worldW + 340) / 36) * Math.ceil((wi.worldH + 340) / 36))} 最快 ${best.toFixed(2)} ms/帧`);
