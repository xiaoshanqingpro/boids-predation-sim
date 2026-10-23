/* task-6 多样本: node _wip/bnd_samples.mjs <html> <样本数> <每样本帧数>
 * 输出每个样本的(总捕获/隼①/隼②/鹰)与均值, 用来把"随机性"和"回归"分开。 */
import fs from "node:fs"; import vm from "node:vm";
const HTML = process.argv[2] || "掠食竞赛.html";
const K = Number(process.argv[3] || 3);
const FR = Number(process.argv[4] || 5000);
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
const out = [];
for (let s = 0; s < K; s++) {
  SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);
  const k0 = SIM.kills.slice();
  let minEdge = 1e9, outFrames = 0;
  const wi = SIM.worldInfo(); SIM.resetBoundStats();
  for (let f = 0; f < FR; f++) {
    SIM.step();
    if (f % 5 === 0) {
      for (let i = 0; i < SIM.raptorCount.total; i++) {
        const h = SIM.hunter(i);
        const e = Math.min(h.x, wi.worldW - h.x, h.y, wi.worldH - h.y);
        if (e < minEdge) minEdge = e;
        if (e < 0) outFrames++;
      }
    }
  }
  const k1 = SIM.kills.slice();
  const t = (k1[0] - k0[0]) + (k1[1] - k0[1]) + (k1[2] - k0[2]);
  const w2 = SIM.worldInfo();
  out.push({ t, f0: k1[0] - k0[0], f1: k1[1] - k0[1], e: k1[2] - k0[2], minEdge, outFrames, clamp: w2.clampCount });
  console.log(`样本${s + 1}: 总捕获 ${t} (隼 ${out[s].f0}/${out[s].f1} 鹰 ${out[s].e}) 猛禽到边最近 ${minEdge.toFixed(1)}px 越界采样帧 ${outFrames} clamp=${w2.clampCount}`);
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`[${HTML}] ${K} 样本 × ${FR} 帧: 总捕获 均值 ${mean(out.map(o => o.t)).toFixed(1)} (${out.map(o => o.t).join("/")}); 最小到边 ${Math.min(...out.map(o => o.minEdge)).toFixed(1)}px; 越界帧合计 ${out.reduce((a, o) => a + o.outFrames, 0)}; clamp 合计 ${out.reduce((a, o) => a + o.clamp, 0)}`);
