/* W6 细粒度诊断: 在 _wip/w6_scratch.html 上逐帧分解 inCone3 的两个分支
 * 用法: node _wip/w6_diag2.mjs [帧数] [N]
 */
import fs from "node:fs"; import vm from "node:vm";
const FRAMES = Number(process.argv[2] || 5000);
const NN = Number(process.argv[3] || 2000);
const html = fs.readFileSync("_wip/w6_scratch.html", "utf8");
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

SIM.setGeometry(false); SIM.setN(NN); SIM.setRefill(true); SIM.resetFlocks();

const kinds = ["falcon", "eagle"];
const A = {};
for (const k of kinds) A[k] = {
  frames: 0, eng: 0, mine3: 0, two: 0, d3lt: 0, twoAndD3: 0,
  minDz: 1e9, maxDz: 1e9 * -1, minD2h: 1e9, minD3: 1e9,
  maxCos3: -9, maxCos3dz: 0, maxCos3d2h: 0, maxCos3az: 0,
  whatIfHorizR: 0, whatIfNoZ: 0,
  samples: [],
};
let prev = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
let engHitFrame = { falcon: 0, eagle: 0 };

for (let f = 1; f <= FRAMES; f++) {
  SIM.step();
  const C = SIM.__coneCtx();
  const rc = SIM.raptorCount;
  for (let i = 0; i < rc.total; i++) {
    const r = SIM.hunter(i);
    const k = A[r.kind] ? r.kind : "falcon";
    const a = A[k];
    a.frames++;
    let dx = r.x - C.Lx, dy = r.y - C.Ly;
    const d2h = Math.hypot(dx, dy);
    const dz = C.grav ? r.z - C.leaderZ : 0;
    const d3 = Math.hypot(d2h, dz);
    const az2 = Math.max(-0.45, Math.min(0.45, C.leaderVZ * 0.25));
    const al = Math.hypot(1, az2);
    const cos3 = d3 > 0 ? (dx * Math.cos(C.leaderAng) + dy * Math.sin(C.leaderAng) + dz * az2) / (d3 * al) : 0;
    const two = SIM.inCone(r.x, r.y);
    const eng = SIM.inCone3(r.x, r.y, r.z);
    a.mine3 += eng ? 1 : 0;
    a.two += two ? 1 : 0;
    if (d3 < C.R) a.d3lt++;
    if (two && d3 < C.R) a.twoAndD3++;
    if (Math.abs(dz) < a.minDz) a.minDz = Math.abs(dz);
    if (dz > a.maxDz) a.maxDz = dz;
    if (d2h < a.minD2h) a.minD2h = d2h;
    if (d3 < a.minD3) a.minD3 = d3;
    // what-if: 半径用水平距离, 角度仍含 dz
    if (d2h < C.R && cos3 > C.COS) a.whatIfHorizR++;
    // what-if: 纯 2D(与 ?grav=0 路径一致)
    if (two) a.whatIfNoZ++;
    if (two && cos3 > a.maxCos3) { a.maxCos3 = cos3; a.maxCos3dz = dz; a.maxCos3d2h = d2h; a.maxCos3az = az2; }
    if (two && a.samples.length < 12) a.samples.push({ f, d2h: +d2h.toFixed(1), dz: +dz.toFixed(1), d3: +d3.toFixed(1), az2: +az2.toFixed(2), cos3: +cos3.toFixed(3), eng });
  }
  // 引擎计数增量(逐帧归因)
  const dF = SIM.stats.coneFalconFrames - prev.coneFalconFrames;
  const dE = SIM.stats.coneEagleDrain - prev.coneEagleDrain;
  prev = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
  if (dF) A.falcon.eng += dF;
  if (dE) A.eagle.eng += dE;
  if (dF) engHitFrame.falcon = f;
  if (dE) engHitFrame.eagle = f;
}

console.log(`帧 ${FRAMES} N=${NN} 世界 ${JSON.stringify(SIM.worldInfo())}`);
for (const k of kinds) {
  const a = A[k];
  if (!a.frames) continue;
  console.log(`\n[${k}] 出现帧 ${a.frames}`);
  console.log(`  引擎 coneFalconFrames/coneEagleDrain 增量=${a.eng} (最后命中帧 ${engHitFrame[k] || "-"}) | 我的 inCone3 复算=${a.mine3} | inCone(2D)=${a.two}`);
  console.log(`  d3<180 帧=${a.d3lt} | 2D锥内 且 d3<180 帧=${a.twoAndD3}`);
  console.log(`  最小水平 ${a.minD2h.toFixed(0)} | 最小3D ${a.minD3.toFixed(0)} | |dz| min ${a.minDz.toFixed(0)} / dz max ${a.maxDz.toFixed(0)}`);
  console.log(`  2D锥内帧的 cos3: max ${a.maxCos3.toFixed(3)} (d2h=${a.maxCos3d2h.toFixed(0)}, dz=${a.maxCos3dz.toFixed(0)}, az2=${a.maxCos3az.toFixed(2)})  [阈值 ${Math.cos(Math.PI / 3)}]`);
  console.log(`  what-if 半径用水平距离+3D角度: ${a.whatIfHorizR} | what-if 纯2D: ${a.whatIfNoZ}`);
  console.log(`  2D锥内样本: ${JSON.stringify(a.samples)}`);
}
