/* task-6 验收口径: setRefill(false) + 5000 帧, 总捕获与两只隼是否都开张 */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[3] || "掠食竞赛.html", "utf8");
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
const REFILL = process.argv.includes("--refill");
const FR = Number(process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : 5000);
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(REFILL);
const marks = [400, 1000, 2000, 3000, 4000, 5000];
const rows = [];
let dashFrames = 0, dashStarts = 0, prevDash = [0, 0, 0, 0, 0, 0, 0, 0];
for (let f = 1; f <= FR; f++) {
  SIM.step();
  const tot = SIM.raptorCount.total;
  for (let k = 0; k < tot; k++) {
    const h = SIM.hunter(k);
    if (h.dashT > 0) dashFrames++;
    if (h.dashT > 0 && !(prevDash[k] > 0)) dashStarts++;
    prevDash[k] = h.dashT;
  }
  if (marks.includes(f)) rows.push(`f${f}: 总捕获 ${SIM.kills.reduce((a, b) => a + b, 0)} (隼 ${SIM.kills[0]}/${SIM.kills[1]} 鹰 ${SIM.kills[2]}) 存活 ${SIM.aliveCount}`);
}
console.log(`setRefill(${REFILL}) ${FR} 帧:`);
console.log(rows.join("\n"));
const total = SIM.kills[0] + SIM.kills[1] + SIM.kills[2];
console.log(`冲刺: 发起 ${dashStarts} 次 / 冲刺帧 ${dashFrames}; stats.dashEnds=${SIM.stats.dashEnds} missFalcon=${SIM.stats.missFalcon} lockedDashes=${SIM.stats.lockedDashes}`);
console.log(`总捕获 ${total} (≥100 ${total >= 100 ? "✓" : "✗"}); 两只隼都开张 ${SIM.kills[0] > 0 && SIM.kills[1] > 0 ? "✓" : "✗"} (${SIM.kills[0]}/${SIM.kills[1]})`);
