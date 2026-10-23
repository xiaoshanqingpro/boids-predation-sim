/* 用与 golden.mjs 完全相同的摘要, 逐帧比对第7轮基准 与 三维版(带 query)。
 * 目的: 找出守恒线在哪里、哪一组状态开始分叉。
 * 用法: node _checks/divergence_full3d.mjs <file> "<query>"
 */
import fs from "node:fs"; import vm from "node:vm";
const dir = "_archive";
function load(file, query) {
  const code = [...fs.readFileSync(file, "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : (p === "canvas" ? { width: 1280, height: 720 } : () => {}))), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const d = { getElementById: id => { if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} }, getContext: () => ctx, width: 1280, height: 720, addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) }); return els.get(id); },
              addEventListener() {}, createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
  let s = 20261015 >>> 0;
  const M = Object.create(Math); M.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: query } }, location: { search: query }, Math: M, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sb); vm.runInContext(code, sb, { filename: file });
  const SIM = sb.window.SIM;
  SIM.setGeometry(false);
  if (SIM.setGravity) SIM.setGravity(false);
  if (SIM.setView3D) SIM.setView3D(false);
  SIM.setN(2000);
  return SIM;
}
function groups(SIM) {
  const q = v => Math.round(v * 4096) | 0;
  const star = [], goose = [], hunt = [], misc = [], Q = [], pol = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); star.push(s.alive ? 1 : 0); if (s.alive) star.push(q(s.x), q(s.y), q(s.vx), q(s.vy)); }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); goose.push(g.alive ? 1 : 0, q(g.x), q(g.y)); }
  for (let i = 0; i < 3; i++) { const u = SIM.hunter(i); hunt.push(q(u.x), q(u.y), q(u.vx), q(u.vy), q(u.energy)); }
  for (const v of SIM.scores) misc.push(q(v));
  for (const v of SIM.kills) misc.push(v);
  for (const v of SIM.Q) Q.push(q(v));
  const gi = SIM.geeseInfo; misc.push(gi.leaderIdx, gi.shift, gi.disarray, gi.juvenileAlive);
  for (const p of SIM.falconPolicies) pol.push(q(p.normalized[0]), q(p.normalized[4]), p.gen, p.periods);
  return { star, goose, hunt, misc, Q, pol };
}
function cmp(a, b) {
  for (const k of Object.keys(a)) {
    const n = Math.max(a[k].length, b[k].length);
    for (let i = 0; i < n; i++) if (a[k][i] !== b[k][i]) return { group: k, idx: i, va: a[k][i], vb: b[k][i] };
  }
  return null;
}
const file = process.argv[2], query = process.argv[3] || "";
const A = load(dir + "/round7.html", query);
const B = load(file, query);
/* 与 golden.mjs 逐字相同的 FNV-1a 混入, 便于核对绝对哈希值 */
function goldenHash(SIM) {
  const q = v => Math.round(v * 4096) | 0;
  let h = 0x811c9dc5;
  const mix = x => { h ^= (x & 0xffffffff); h = Math.imul(h, 0x01000193); h ^= ((x >>> 16) & 0xffff); h = Math.imul(h, 0x01000193); };
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); mix(s.alive ? 1 : 0); if (s.alive) { mix(q(s.x)); mix(q(s.y)); mix(q(s.vx)); mix(q(s.vy)); } }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); mix(g.alive ? 1 : 0); mix(q(g.x)); mix(q(g.y)); }
  for (let i = 0; i < 3; i++) { const u = SIM.hunter(i); mix(q(u.x)); mix(q(u.y)); mix(q(u.vx)); mix(q(u.vy)); mix(q(u.energy)); }
  for (const v of SIM.scores) mix(q(v));
  for (const v of SIM.kills) mix(v);
  for (const v of SIM.Q) mix(q(v));
  const gi = SIM.geeseInfo; mix(gi.leaderIdx); mix(gi.shift); mix(gi.disarray); mix(gi.juvenileAlive);
  for (const p of SIM.falconPolicies) { mix(q(p.normalized[0])); mix(q(p.normalized[4])); mix(p.gen); mix(p.periods); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
let r = cmp(groups(A), groups(B));
console.log(`基准(_archive/round7.html) vs 被测(${file})  query="${query}"`);
if (!r) console.log("  帧 0: 逐位一致 ✓");
else console.log(`  帧 0: ✗ 分叉于 ${r.group}[${r.idx}]  基准=${r.va} 被测=${r.vb}`);
let frame = 0, hit = r ? 0 : -1;
if (!r) {
  for (frame = 1; frame <= 2000; frame++) {
    A.step(); B.step();
    r = cmp(groups(A), groups(B));
    if (r) { hit = frame; break; }
  }
}
if (hit === 0) console.log("  → 初始化就不同(随机流或初始化公式)");
else if (hit < 0) console.log("  → 2000 帧全程逐位一致 ✓✓ 守恒线成立");
else console.log(`  → 第一次分叉在第 ${hit} 帧, 组=${r.group}[${r.idx}] 基准=${r.va} 被测=${r.vb}`);
// 2000 帧跑完后, 两边的绝对哈希(应与 golden.mjs 的 PHYSICS_HASH 一致)
console.log(`  绝对哈希: 基准(第7轮)=${goldenHash(A)}  被测=${goldenHash(B)}   (golden.mjs 对第7轮报 9ae66dff)`);
