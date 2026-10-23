/* 与机器负载无关的性能判定: 同进程内**交替**测"当前"与"第7轮基准", 用比值判定。
 * 用法: node _probe_perf.mjs [当前html] [基准html] [帧数]                        */
import fs from "node:fs"; import vm from "node:vm";
function load(file, query) {
  const html = fs.readFileSync(file, "utf8");
  const cut = html.indexOf('<script type="text/plain"');
  const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
  const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
  const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: query || "" } }, location: { search: query || "" }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
  const SIM = sb.window.SIM;
  SIM.setGeometry(false); SIM.setN(2000);
  if (SIM.setGravity) SIM.setGravity(true);
  if (SIM.setRefill) SIM.setRefill(false);
  for (let i = 0; i < 200; i++) SIM.step();
  return SIM;
}
const cur = process.argv[2] || "掠食竞赛.html";
const base = process.argv[3] || "_archive/round7.html";
const FR = Number(process.argv[4] || 300);
const A = load(cur), B = load(base);
const sample = (SIM, n) => { const t0 = Date.now(); for (let i = 0; i < n; i++) SIM.step(); return (Date.now() - t0) / n; };
const a = [], b = [];
for (let r = 0; r < 5; r++) { a.push(sample(A, FR)); b.push(sample(B, FR)); }   // 交替采样: 负载对两者近似相同
const med = x => x.slice().sort((p, q) => p - q)[Math.floor(x.length / 2)];
const mA = med(a), mB = med(b), rt = mA / mB;
console.log(`当前(${cur}): ${mA.toFixed(2)} ms/帧   读数 ${a.map(v => v.toFixed(2)).join("/")}`);
console.log(`基准(${base}): ${mB.toFixed(2)} ms/帧   读数 ${b.map(v => v.toFixed(2)).join("/")}`);
console.log(`比值 当前/基准 = ${rt.toFixed(3)}  (与机器负载无关; 建议阈值 ≤1.50 判 PASS)`);
console.log(rt <= 1.5 ? "PASS: 性能未相对基准恶化超过 1.5×" : "FAIL: 相对基准恶化超过 1.5×");
