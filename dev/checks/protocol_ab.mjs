/* 守恒线协议冲突判定(方案 A vs 方案 B)
 * 唯一变量 = 加载几个 <script> 块; 其余(桩/种子/哈希/调用顺序)完全一致。
 * 用法: node _checks/protocol_ab.mjs
 */
import fs from "node:fs"; import vm from "node:vm";

function loadBlocksOf(file) {
  let raw = fs.readFileSync(file, "utf8");
  const cut = raw.indexOf('<script type="text/plain"');
  if (cut > 0) raw = raw.slice(0, cut);                 // 说明容器正文里也有 "<script>" 字样
  return [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}
function runOne(file, mode, query) {
  const blocks = loadBlocksOf(file);
  const code = mode === "all3" ? blocks.join("\n;\n") : blocks[0];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : (p === "canvas" ? { width: 1280, height: 720 } : () => {}))), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const doc = { getElementById: id => { if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} }, getContext: () => ctx, width: 1280, height: 720, addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) }); return els.get(id); },
                addEventListener() {}, createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
  let s = 20261015 >>> 0;
  const M = Object.create(Math); M.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sb = { document: doc, window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: query } }, location: { search: query }, Math: M, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sb); vm.runInContext(code, sb, { filename: file });
  const SIM = sb.window.SIM;
  // 与 golden.mjs 完全相同的调用顺序
  if (SIM.setGravity) SIM.setGravity(false);
  if (SIM.setView3D) SIM.setView3D(false);
  SIM.setGeometry(false);
  SIM.setN(2000);
  for (let i = 0; i < 2000; i++) SIM.step();
  const q = v => Math.round(v * 4096) | 0;
  let h = 0x811c9dc5;
  const mix = x => { h ^= (x & 0xffffffff); h = Math.imul(h, 0x01000193); h ^= ((x >>> 16) & 0xffff); h = Math.imul(h, 0x01000193); };
  for (let i = 0; i < SIM.N; i++) { const st = SIM.starling(i); mix(st.alive ? 1 : 0); if (st.alive) { mix(q(st.x)); mix(q(st.y)); mix(q(st.vx)); mix(q(st.vy)); } }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); mix(g.alive ? 1 : 0); mix(q(g.x)); mix(q(g.y)); }
  for (let i = 0; i < 3; i++) { const u = SIM.hunter(i); mix(q(u.x)); mix(q(u.y)); mix(q(u.vx)); mix(q(u.vy)); mix(q(u.energy)); }
  for (const v of SIM.scores) mix(q(v));
  for (const v of SIM.kills) mix(v);
  for (const v of SIM.Q) mix(q(v));
  const gi = SIM.geeseInfo; mix(gi.leaderIdx); mix(gi.shift); mix(gi.disarray); mix(gi.juvenileAlive);
  for (const p of SIM.falconPolicies) { mix(q(p.normalized[0])); mix(q(p.normalized[4])); mix(p.gen); mix(p.periods); }
  return { hash: (h >>> 0).toString(16).padStart(8, "0"), kills: SIM.kills.join(","), blocks: blocks.length };
}
const dir = "_archive";
const R7 = dir + "/round7.html", DELIV = process.argv[2] || "掠食竞赛.html", Q = process.argv[3] || "?grav=0";
const res = {};
for (const [fname, file] of [["第7轮", R7], ["被测文件", DELIV]]) {
  for (const mode of ["block1", "all3"]) {
    res[fname + "|" + mode] = runOne(file, mode, Q);
  }
}
console.log("模式说明: block1 = 只加载第 1 个 <script>(golden.mjs 的做法); all3 = 三个块拼接加载");
console.log("");
console.log("文件        加载模式    PHYSICS_HASH   kills");
for (const k of Object.keys(res)) {
  const [f, m] = k.split("|");
  console.log(`${f.padEnd(10)}  ${m.padEnd(8)}  ${res[k].hash}     ${res[k].kills}`);
}
console.log("");
const b1r = res["第7轮|block1"].hash, b1d = res["被测文件|block1"].hash;
const a3r = res["第7轮|all3"].hash, a3d = res["被测文件|all3"].hash;
console.log(`block1 模式下: 第7轮=${b1r}  三维=${b1d}  ${b1r === b1d ? "一致" : "不一致(复现了冲突)"}`);
console.log(`all3   模式下: 第7轮=${a3r}  三维=${a3d}  ${a3r === a3d ? "一致(守恒线成立)" : "不一致"}`);
console.log("");
if (b1r !== b1d && a3r === a3d) {
  console.log("判定 = 方案 A 成立: 冲突完全由『加载几个块』造成 —— golden.mjs 只加载块1,");
  console.log("        而三维版的行为依赖块2/块3(在加载期就改变了状态/随机流)。这不是物理耦合, 是测试桩选择。");
} else if (b1r === b1d && a3r === a3d) {
  console.log("判定 = 两者都一致: 之前的差异来自我早先的桩/顺序差异, 现已排除。");
} else if (a3r !== a3d) {
  console.log("判定 = 方案 B 方向: 即便按三块加载, 两个文件仍不一致 -> 存在残余耦合, 需逐项定位。");
} else {
  console.log("判定 = 需要进一步排查(组合未覆盖: block1 一致但 all3 不一致)。");
}
