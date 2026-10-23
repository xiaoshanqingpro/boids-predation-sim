/* task-3: 性能红线复测 —— N=2000 单帧 step 中位数(改前/改后同口径, 只跑 step()).
 * 参考脚本 _checks/bench_physics.mjs 硬编码主文件, 这里加一个文件参数以便 A/B。
 * 用法: node _checks/task3_bench.mjs [file.html] [steps]
 */
import fs from "node:fs"; import vm from "node:vm";
const FILE = process.argv[2] && process.argv[2].endsWith(".html") ? process.argv[2] : "掠食竞赛.html";
const STEPS = Number(process.argv[3] || 400);
const html = fs.readFileSync(FILE, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c") };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false);
const rows = SIM.bench(STEPS, [2000, 5000, 10000]);
const r = rows.find(x => x.n === 2000);
console.log(FILE + " SIM.bench(" + STEPS + "): N=2000 step 中位 " + r.median + " ms / p90 " + r.p90 + " / mean " + r.mean +
            " | N=10000 中位 " + rows.find(x => x.n === 10000).median + " ms");
