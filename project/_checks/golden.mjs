/* ============================================================================
 * 物理金标准: 固定随机种子跑固定步数, 输出状态哈希。
 * 用途: 渲染迁移 / 零分配改造前后必须逐字节一致 —— 证明"物理语义一行不改"。
 * 用法: node _checks/golden.mjs [帧数]
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] && process.argv[2].endsWith(".html") ? process.argv[2]
           : path.join(here, "..", "掠食竞赛.html");
const FRAMES = Number(process.argv[3] || 600);
// 【参数坑】QUERY 必须取 argv[4]: argv[3] 是帧数。之前写成 argv[3] 时 "?grav=0" 从没生效,
// 导致三维版在加载期按 GRAV_ON=true 初始化(多消耗随机数), 守恒线被误判为不成立。
const QUERY = process.argv[4] || "";
let html = fs.readFileSync(file, "utf8");
const cut = html.indexOf('<script type="text/plain"');   // 说明容器正文里不再有裸 <script>, 这里仍兜底
if (cut > 0) html = html.slice(0, cut);
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => grad;
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "canvas") return { width: 1280, height: 720 };
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function seededMath(seed) {
  let s = seed >>> 0;
  const M = Object.create(Math);
  M.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return M;
}
const els = new Map();
const documentStub = {
  getElementById(id) {
    if (!els.has(id)) els.set(id, {
      id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {},
      classList: { toggle() {} }, getContext: makeCtx, width: 1280, height: 720,
      addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
    });
    return els.get(id);
  },
  addEventListener() {},
  createElement: () => ({ width: 0, height: 0, getContext: makeCtx, style: {} }),
};
const sandbox = {
  document: documentStub, window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: QUERY } }, location: { search: QUERY }, Math: seededMath(20261015),
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: file });
const SIM = sandbox.window.SIM;
// 第 8 轮(3D)守恒线: 关重力 + 俯视时, xy 物理必须与三维化之前逐位一致。
// 【顺序要紧】必须先切开关再 setGeometry(它会 resetFlocks/resetPredators):
//  · 三维版在初始化时按 GRAV_ON 决定要不要消耗随机数(z/VZ 初值), 事后关重力无法复原种子流;
//  · setView3D 会触发 toggleView(), 放在重置之后会引入副作用。
// 老版本没有这两个钩子, 按存在与否调用(向后兼容)。
if (SIM.setGravity) SIM.setGravity(false);
if (SIM.setView3D) SIM.setView3D(false);
SIM.setGeometry(false);
SIM.setN(2000);
for (let i = 0; i < FRAMES; i++) SIM.step();

// 取状态指纹: 位置/速度的定点量化(避免浮点打印误差), 用 FNV-1a 汇总
function hashQ(v) { return Math.round(v * 4096) | 0; }
let h = 0x811c9dc5;
function mix(x) {
  h ^= (x & 0xffffffff); h = Math.imul(h, 0x01000193);
  h ^= ((x >>> 16) & 0xffff); h = Math.imul(h, 0x01000193);
}
for (let i = 0; i < SIM.N; i++) {
  const s = SIM.starling(i);
  mix(s.alive ? 1 : 0);
  if (s.alive) { mix(hashQ(s.x)); mix(hashQ(s.y)); mix(hashQ(s.vx)); mix(hashQ(s.vy)); }
}
for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); mix(g.alive ? 1 : 0); mix(hashQ(g.x)); mix(hashQ(g.y)); }
for (let i = 0; i < 3; i++) { const u = SIM.hunter(i); mix(hashQ(u.x)); mix(hashQ(u.y)); mix(hashQ(u.vx)); mix(hashQ(u.vy)); mix(hashQ(u.energy)); }
for (const v of SIM.scores) mix(hashQ(v));
for (const v of SIM.kills) mix(v);
for (const v of SIM.Q) mix(hashQ(v));
const gi = SIM.geeseInfo;
mix(gi.leaderIdx); mix(gi.shift); mix(gi.disarray); mix(gi.juvenileAlive);
const gp = SIM.falconPolicies;
for (const p of gp) { mix(hashQ(p.normalized[0])); mix(hashQ(p.normalized[4])); mix(p.gen); mix(p.periods); }

console.log(`FRAMES=${FRAMES} N=${SIM.N}`);
console.log(`scores=${SIM.scores.join(",")} kills=${SIM.kills.join(",")} aliveStarling=${SIM.aliveCount} aliveGoose=${SIM.galiveCount}`);
console.log(`leaderIdx=${gi.leaderIdx} shift=${gi.shift} juvenile=${gi.juvenileAlive} disarray=${gi.disarray}`);
console.log(`falconPolicies=${gp.map(p => p.gen + "/" + p.periods + "/" + p.normalized[0].toFixed(6)).join(" ")}`);
console.log(`PHYSICS_HASH=${(h >>> 0).toString(16).padStart(8, "0")}`);
