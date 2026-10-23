/* W1 验收: 世界/视口解耦 + 边界厌恶(不撞边、不夹取) */
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[3] || "掠食竞赛.html", "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: process.argv[4] || "" } }, location: { search: process.argv[4] || "" }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
const wi = SIM.worldInfo ? SIM.worldInfo() : null;
console.log("worldInfo:", JSON.stringify(wi));
if (!wi) { console.log("FAIL: 没有 SIM.worldInfo()"); process.exit(1); }
SIM.resetBoundStats();
const FR = Number(process.argv[2] || 5000);
let minS = 1e9, minG = 1e9, minR = 1e9, outFrames = 0;
for (let f = 0; f < FR; f++) {
  SIM.step();
  const chk = (o, tag) => {
    const e = Math.min(o.x, wi.worldW - o.x, o.y, wi.worldH - o.y);
    if (e < 0) outFrames++;
    return e;
  };
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) { const e = chk(s); if (e < minS) minS = e; } }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g.alive) { const e = chk(g); if (e < minG) minG = e; } }
  for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunter(k); const e = chk(h); if (e < minR) minR = e; }
}
const w2 = SIM.worldInfo();
console.log(`${FR} 帧: 到边界最近距离 —— 椋鸟 ${minS.toFixed(1)}px, 雁 ${minG.toFixed(1)}px, 猛禽 ${minR.toFixed(1)}px`);
console.log(`夹取次数 ${w2.clampCount} (期望 0); 越界帧 ${outFrames} (期望 0); 最大侵入峰值 ${w2.peakPenetration.toFixed(3)} (0=从未进入厌恶带内)`);
console.log(`世界 ${w2.worldW}×${w2.worldH} vs 视口 ${w2.viewW}×${w2.viewH}; 解耦=${w2.worldW !== w2.viewW && w2.worldH !== w2.viewH}`);
const pass = minS >= 40 && minG >= 40 && w2.clampCount === 0 && outFrames === 0;
console.log(pass ? "PASS: 边界厌恶有效(无夹取/无越界/均 ≥40px)" : "FAIL: 见上");
