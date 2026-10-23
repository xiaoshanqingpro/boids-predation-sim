/* W6 只读诊断: 威慑锥失血回归 —— 锥几何 vs 3D 判据
 * 复现 headless.mjs [11] 段前的上下文: setGeometry(false) + resetFlocks() + 3600 帧
 * 输出: 2D 锥命中 / 3D 锥命中 / 各猛禽与雁尖 (水平距离, dz, 3D 距离) 的分布
 * 用法: node _wip/w6_diag.mjs [路径\掠食竞赛.html] [帧数]
 */
import fs from "node:fs"; import vm from "node:vm";
const file = process.argv[2] || "掠食竞赛.html";
const FRAMES = Number(process.argv[3] || 3600);
const html = fs.readFileSync(file, "utf8");
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

const CONE_R = 180, CONE_COS = Math.cos(Math.PI / 3);
console.log(`gravity=${SIM.gravity} view3D=${SIM.view3D} raptorCount=${JSON.stringify(SIM.raptorCount)}`);

SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(false);
SIM.resetFlocks();
const s0 = { ...SIM.stats };

const kinds = ["falcon", "eagle", "ghunter"];
const acc = {};                       // 每类猛禽的累计
for (const k of kinds) acc[k] = { frames: 0, cone2D: 0, cone3D0: 0, under180_2D: 0,
  min3D: 1e9, min2D: 1e9, minDz: 1e9, maxDzAbsAt180: 0, dzSum: 0, dzN: 0, fMin3D: -1, fMin2D: -1,
  dashFrames: 0, dashInCone2D: 0 };
const sample = [];                    // 关键帧快照

// 雁尖所在层的分布 + 猛禽层分布
const zLayer = { gooseLead: [], falcon: [], eagle: [] };

for (let f = 1; f <= FRAMES; f++) {
  SIM.step();
  const L = SIM.leader;                // {x,y,ang,z}
  const raptors = [];
  const rc = SIM.raptorCount;
  for (let i = 0; i < rc.total; i++) raptors.push(SIM.hunter(i));
  for (const r of raptors) {
    const k = acc[r.kind] ? r.kind : "falcon";
    let dx = r.x - L.x, dy = r.y - L.y;
    const d2h = Math.hypot(dx, dy);
    const dz = r.z - L.z;
    const d3 = Math.hypot(d2h, dz);
    const a = acc[k];
    a.frames++;
    if (r.dashT > 0) a.dashFrames++;
    if (d2h < CONE_R) a.under180_2D++;
    const hit2D = SIM.inCone(r.x, r.y);
    if (hit2D) a.cone2D++;
    if (r.dashT > 0 && hit2D) a.dashInCone2D++;
    // 3D 锥近似(az2=0 版本; 引擎的 az2 是领队 vZ*0.25, 量级 ±0.45)
    const cosA = d3 > 0 ? (dx * Math.cos(L.ang) + dy * Math.sin(L.ang)) / d3 : 0;
    if (d3 < CONE_R && cosA > CONE_COS) a.cone3D0++;
    if (d3 < a.min3D) { a.min3D = d3; a.fMin3D = f; }
    if (d2h < a.min2D) { a.min2D = d2h; a.fMin2D = f; }
    if (Math.abs(dz) < a.minDz) a.minDz = Math.abs(dz);
    a.dzSum += Math.abs(dz); a.dzN++;
    if (f === 1 || f === 120 || f === 600 || f === 1800 || f === 3600) zLayer[k] && zLayer[k].push(r.z);
  }
  if (f === 1 || f === 120 || f === 600 || f === 1800 || f === 3600) {
    const names = raptors.map(r => `${r.kind}:d2D=${Math.hypot(r.x - L.x, r.y - L.y).toFixed(0)},dz=${(r.z - L.z).toFixed(0)},d3=${Math.hypot(Math.hypot(r.x - L.x, r.y - L.y), r.z - L.z).toFixed(0)},dash=${r.dashT > 0 ? 1 : 0}`).join(" | ");
    sample.push(`f${String(f).padStart(4)} 雁尖(${L.x.toFixed(0)},${L.y.toFixed(0)},z=${L.z.toFixed(0)}) ang=${L.ang.toFixed(2)} :: ${names}`);
  }
  zLayer.gooseLead.push(L.z);
}

const s1 = SIM.stats;
console.log("\n--- 关键帧快照 ---");
console.log(sample.join("\n"));

console.log("\n--- 每类猛禽累计(全 " + FRAMES + " 帧) ---");
for (const k of kinds) {
  const a = acc[k];
  if (!a.frames) continue;
  console.log(`${k}: 出现帧 ${a.frames} | inCone(2D,引擎导出) ${a.cone2D} | 3D<180 且角度内(az2=0近似) ${a.cone3D0} |` +
    ` 水平<180px 帧 ${a.under180_2D} | dash帧 ${a.dashFrames} (其中2D锥内 ${a.dashInCone2D})`);
  console.log(`     最小 3D 距离 ${a.min3D.toFixed(0)}px @f${a.fMin3D} | 最小水平距离 ${a.min2D.toFixed(0)}px @f${a.fMin2D} |` +
    ` 最小 |dz| ${a.minDz.toFixed(0)}px | 平均 |dz| ${(a.dzSum / Math.max(a.dzN, 1)).toFixed(0)}px`);
}

console.log("\n--- 引擎计数器 ---");
for (const key of ["coneFalconFrames", "coneEagleDrain", "dashEndInCone", "dashEnds"]) {
  console.log(`${key}: ${s0[key] === undefined ? "(无)" : (s1[key] - s0[key])} (累计 ${s1[key]})`);
}

const zs = zLayer.gooseLead.slice().sort((x, y) => x - y);
console.log(`\n雁尖 z 分布: min=${zs[0].toFixed(0)} p50=${zs[zs.length >> 1].toFixed(0)} max=${zs[zs.length - 1].toFixed(0)}`);
console.log(`猛禽 z 采样(每类前5个关键帧) ${JSON.stringify({ falcon: zLayer.falcon.slice(0, 5), eagle: zLayer.eagle.slice(0, 5) })}`);
console.log(`世界 ${JSON.stringify(SIM.worldInfo ? SIM.worldInfo() : {})}`);
