/* W6 配对诊断: 同一随机种子下, 比较"修复前 inCone3(3D球锥)"与"修复后(水平半径+垂直带)"的锥内命中
 * 用法: node _wip/w6_pair.mjs <html> [帧数] [N] [seed]
 * 输出: 引擎计数器(实际代码路径) + 两种公式的复算命中(应各自等于对应版本的引擎值)
 */
import fs from "node:fs"; import vm from "node:vm";
const file = process.argv[2] || "_wip/w6_scratch.html";
const FRAMES = Number(process.argv[3] || 5000);
const NN = Number(process.argv[4] || 2000);
const SEED = Number(process.argv[5] || 20261015);
const html = fs.readFileSync(file, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
const els = new Map();
const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c" + Math.random()) };
let s = SEED >>> 0;
const seeded = Object.create(Math);
seeded.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, Math: seeded, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
const SIM = sb.window.SIM;
SIM.setGeometry(false); SIM.setN(NN); SIM.setRefill(true); SIM.resetFlocks();

const kinds = ["falcon", "eagle"];
const A = {}; for (const k of kinds) A[k] = { frames: 0, two: 0, old: 0, neu: 0, neu2: 0, bandCut: 0, dzSum: 0, dzN: 0, maxAbsDz: 0 };
let prev = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
const eng = { falcon: 0, eagle: 0 };
for (let f = 1; f <= FRAMES; f++) {
  SIM.step();
  const C = SIM.__coneCtx();
  for (let i = 0; i < SIM.raptorCount.total; i++) {
    const r = SIM.hunter(i);
    const k = A[r.kind] ? r.kind : "falcon";
    const a = A[k];
    a.frames++;
    const dx = r.x - C.Lx, dy = r.y - C.Ly;
    const d2h = Math.hypot(dx, dy);
    const dz = C.grav ? r.z - C.leaderZ : 0;
    const d3 = Math.hypot(d2h, dz);
    const az2 = Math.max(-0.45, Math.min(0.45, C.leaderVZ * 0.25));
    const al = Math.hypot(1, az2);
    const ca = Math.cos(C.leaderAng), sa = Math.sin(C.leaderAng);
    const num = dx * ca + dy * sa + dz * az2;
    const oldHit = d3 <= C.R && num / ((d3 || 1) * al) > C.COS;
    const neuHit = d2h <= C.R && Math.abs(dz) <= C.R && num / ((d3 || 1) * al) > C.COS;
    const neu2Hit = d2h <= C.R && num / ((d3 || 1) * al) > C.COS;
    const two = SIM.inCone(r.x, r.y);
    if (two) a.two++;
    if (oldHit) a.old++;
    if (neuHit) a.neu++;
    if (neu2Hit) a.neu2++;
    if (two && d2h <= C.R && Math.abs(dz) > C.R) a.bandCut++;
    a.dzSum += Math.abs(dz); a.dzN++;
    if (Math.abs(dz) > a.maxAbsDz) a.maxAbsDz = Math.abs(dz);
  }
  const dF = SIM.stats.coneFalconFrames - prev.coneFalconFrames, dE = SIM.stats.coneEagleDrain - prev.coneEagleDrain;
  prev = { coneFalconFrames: SIM.stats.coneFalconFrames, coneEagleDrain: SIM.stats.coneEagleDrain };
  eng.falcon += dF; eng.eagle += dE;
}
console.log(`file=${file} frames=${FRAMES} N=${NN} seed=${SEED}`);
for (const k of kinds) {
  const a = A[k];
  if (!a.frames) continue;
  console.log(`  [${k}] 引擎命中=${eng[k]} | 旧(3D球锥)=${a.old} A1(水平半径+垂直带)=${a.neu} A2(水平半径,无垂直带)=${a.neu2} | 2D锥=${a.two}` +
    ` | 被垂直带挡住(2D锥内但|dz|>R)=${a.bandCut} | 平均|dz|=${(a.dzSum / Math.max(a.dzN, 1)).toFixed(0)} 最大|dz|=${a.maxAbsDz.toFixed(0)}`);
}
console.log(`  stats 累计: coneFalconFrames=${SIM.stats.coneFalconFrames} coneEagleDrain=${SIM.stats.coneEagleDrain} (鹰 pending 失血总量=${(SIM.stats.coneEagleDrain * 0.01).toFixed(2)})`);
console.log(`  雁群存活=${SIM.galiveCount} 总捕获=${SIM.kills.reduce((x, y) => x + y, 0)}`);
