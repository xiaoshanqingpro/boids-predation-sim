/* ============================================================================
 * 物理金标准 / 守恒线：固定随机种子跑固定步数 → 状态哈希 → **与基线比对**。
 * 用途：渲染迁移 / 零分配改造 / 守恒线改动前后必须逐字节一致 —— 证明"物理语义一行不改"。
 *
 * 用法：
 *   node dev/checks/golden.mjs                          # 跑全部声明用例并与基线比对（默认 600 帧, N=2000）
 *   node dev/checks/golden.mjs --case 2d                # 只跑一个用例
 *   node dev/checks/golden.mjs --update                 # 用当前结果写回 dev/checks/golden_baseline.json
 *   node dev/checks/golden.mjs 掠食竞赛_2D.html 600 "?grav=0"   # 临时用例：只打印哈希，基线里有同名条目才比对
 *   node dev/checks/golden.mjs --help
 *
 * 退出码：0 = 全部 PASS；1 = 有失配 / 基线缺失 / 基线配置与本次运行不一致。
 *
 * 为什么默认 600 帧：本机实测 600 帧 / N=2000 约 6 秒（远低于 3 分钟上限），
 * 所以没有降级到 200 帧；帧数写进基线条目（frames 字段），改了就必须 --update。
 *
 * 历史：本脚本原先只 console.log(PHYSICS_HASH=...)，没有任何断言，"守恒线"靠人肉看数字；
 * 现改为与 golden_baseline.json 比对，失配即 exit(1)，才算真回归网。
 * 另修：脚本从项目根 `_checks/` 移到 `dev/checks/` 后，默认 HTML 路径按 `..` 只上溯一级，
 * 指到了不存在的 dev/掠食竞赛.html；现在按仓库根（`../..`）解析。
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..", "..");                 // 仓库根
const BASELINE = path.join(here, "golden_baseline.json");

// 声明的用例（数组，可继续加）：file 相对仓库根，frames/n/query 构成用例签名。
// hash 不在代码里写死，由 golden_baseline.json 保存，--update 生成。
const CASES = [
  { id: "default", file: "掠食竞赛.html", frames: 600, n: 2000, query: "" },
  { id: "2d", file: "掠食竞赛_2D.html", frames: 600, n: 2000, query: "" },
];

// ---------------------------------------------------------------- 参数解析
function parseArgs(argv) {
  const opts = { update: false, help: false, caseId: null, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--update") opts.update = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--case") opts.caseId = argv[++i] ?? null;
    else if (a.startsWith("--case=")) opts.caseId = a.slice(7);
    else opts.positional.push(a);
  }
  return opts;
}
function usage() {
  console.log(`用法:
  node dev/checks/golden.mjs [--update] [--case <id>] [<file.html> [frames] ["?query"]]

  --update     用当前运行结果写回 dev/checks/golden_baseline.json（打印 diff）
  --case <id>  只跑某个声明用例（default / 2d）
  位置参数     临时用例：只打印哈希；若签名与已声明用例一致则与该用例比对

退出码: 0=PASS, 1=FAIL/基线缺失`);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) { usage(); process.exit(0); }

// ---------------------------------------------------------------- 仿真运行
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

/** 跑一个用例：加载 HTML 的 <script> 块，固定种子推进 frames 帧，返回 {hash, SIM, gi, gp}。 */
function runCase(c) {
  const file = path.isAbsolute(c.file) ? c.file : path.join(ROOT, c.file);
  if (!fs.existsSync(file)) throw new Error(`HTML 不存在: ${file}`);
  let html = fs.readFileSync(file, "utf8");
  const cut = html.indexOf('<script type="text/plain"');   // 说明容器正文里不再有裸 <script>, 这里仍兜底
  if (cut > 0) html = html.slice(0, cut);
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

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
    document: documentStub,
    window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: c.query } },
    location: { search: c.query },
    Math: seededMath(20261015),
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    console,
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
  SIM.setN(c.n);
  for (let i = 0; i < c.frames; i++) SIM.step();

  // 取状态指纹: 位置/速度的定点量化(避免浮点打印误差), 用 FNV-1a 汇总
  const hashQ = (v) => Math.round(v * 4096) | 0;
  let h = 0x811c9dc5;
  const mix = (x) => {
    h ^= (x & 0xffffffff); h = Math.imul(h, 0x01000193);
    h ^= ((x >>> 16) & 0xffff); h = Math.imul(h, 0x01000193);
  };
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

  const hash = (h >>> 0).toString(16).padStart(8, "0");
  return { hash, SIM, gi, gp };
}

function reportCase(c, r) {
  const { SIM, gi, gp } = r;
  console.log(`FRAMES=${c.frames} N=${SIM.N} case=${c.id} file=${c.file}${c.query ? " query=" + c.query : ""}`);
  console.log(`scores=${SIM.scores.join(",")} kills=${SIM.kills.join(",")} aliveStarling=${SIM.aliveCount} aliveGoose=${SIM.galiveCount}`);
  console.log(`leaderIdx=${gi.leaderIdx} shift=${gi.shift} juvenile=${gi.juvenileAlive} disarray=${gi.disarray}`);
  console.log(`falconPolicies=${gp.map(p => p.gen + "/" + p.periods + "/" + p.normalized[0].toFixed(6)).join(" ")}`);
  console.log(`PHYSICS_HASH=${r.hash}`);
}

// ---------------------------------------------------------------- 基线读写
/** 归一化成 { id: {file?, frames, n, query, hash} }；兼容 {"id":{...}} / {"cases":[{id,...}]} / [{id,...}] 三种写法。 */
function normalizeBaseline(raw) {
  const map = {};
  const put = (id, rec) => {
    if (!id || !rec || typeof rec !== "object") return;
    map[id] = {
      file: rec.file,
      frames: rec.frames, n: rec.n, query: rec.query,
      hash: String(rec.hash || ""),
    };
  };
  if (Array.isArray(raw)) { for (const rec of raw) put(rec && rec.id, rec); return map; }
  if (raw && Array.isArray(raw.cases)) { for (const rec of raw.cases) put(rec && rec.id, rec); return map; }
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue;          // "_readme" 之类的说明字段
      if (v && typeof v === "object") put(k, v);
    }
  }
  return map;
}
function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return { map: null, raw: null };
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    return { map: normalizeBaseline(raw), raw };
  } catch (e) {
    console.error(`FAIL 基线文件不是合法 JSON: ${BASELINE} —— ${e.message}`);
    console.error(`     修好它，或用 node dev/checks/golden.mjs --update 重新生成。`);
    process.exit(1);
  }
}
function saveBaseline(map) {
  const out = {
    _readme: "golden.mjs 的物理哈希基线。hash 由 node dev/checks/golden.mjs --update 真跑生成，不要手改；改动物理/帧数/N/query 后必须 --update 并在提交信息里说明为什么。",
  };
  for (const id of Object.keys(map).sort()) out[id] = map[id];
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + "\n", "utf8");
}

/** 用例签名是否与基线条目一致（frames/n/query；基线里写了 file 才比 file）。 */
function signatureDiff(c, rec) {
  const diffs = [];
  if (rec.frames !== undefined && Number(rec.frames) !== c.frames) diffs.push(`frames 基线=${rec.frames} 本次=${c.frames}`);
  if (rec.n !== undefined && Number(rec.n) !== c.n) diffs.push(`n 基线=${rec.n} 本次=${c.n}`);
  if (rec.query !== undefined && String(rec.query) !== String(c.query)) diffs.push(`query 基线="${rec.query}" 本次="${c.query}"`);
  if (rec.file !== undefined && String(rec.file) !== c.file) diffs.push(`file 基线=${rec.file} 本次=${c.file}`);
  return diffs;
}

// ---------------------------------------------------------------- 组装本次运行集合
let toRun;
if (opts.positional.length > 0) {
  const [fileArg, framesArg, queryArg] = opts.positional;
  if (!/\.html?$/i.test(fileArg)) {
    console.error(`FAIL 第一个位置参数必须是 .html 文件：${fileArg}`);
    usage();
    process.exit(1);
  }
  const adhoc = {
    id: null,
    file: path.isAbsolute(fileArg) ? fileArg : path.relative(ROOT, path.resolve(process.cwd(), fileArg)).split(path.sep).join("/"),
    frames: Number(framesArg || 600),
    n: 2000,
    query: queryArg || "",
  };
  // 签名与已声明用例一致时复用它（例如 `node ... 掠食竞赛.html 600` 就是 default）
  const declared = CASES.find(c => c.file === adhoc.file && c.frames === adhoc.frames && c.n === adhoc.n && c.query === adhoc.query);
  adhoc.id = declared ? declared.id : "ad-hoc";
  toRun = [adhoc];
} else if (opts.caseId) {
  const found = CASES.filter(c => c.id === opts.caseId);
  if (found.length === 0) {
    console.error(`FAIL 未知用例 ${opts.caseId}（已声明: ${CASES.map(c => c.id).join(", ")}）`);
    process.exit(1);
  }
  toRun = found;
} else {
  toRun = CASES;
}

const isAdhoc = toRun.length === 1 && toRun[0].id === "ad-hoc";

// ---------------------------------------------------------------- 跑 + 比对
const { map: baseline } = loadBaseline();
const results = [];
for (const c of toRun) {
  const r = runCase(c);
  reportCase(c, r);
  results.push({ c, r });
}
console.log("");

let hadFailure = false;
let skipped = 0;
const updated = baseline ? { ...baseline } : {};

for (const { c, r } of results) {
  const rec = baseline ? baseline[c.id] : undefined;

  if (opts.update) {
    const next = { file: c.file, frames: c.frames, n: c.n, query: c.query, hash: r.hash };
    const prevHash = rec ? rec.hash : null;
    const diffs = rec ? signatureDiff(c, rec) : [];
    updated[c.id] = next;
    if (prevHash === null) console.log(`UPDATE ${c.id}: 新增 hash=${r.hash} (frames=${c.frames} n=${c.n} query="${c.query}")`);
    else if (prevHash === r.hash && diffs.length === 0) console.log(`UPDATE ${c.id}: hash 未变 (${r.hash})，配置未变`);
    else {
      console.log(`UPDATE ${c.id}: ${prevHash} -> ${r.hash}`);
      for (const d of diffs) console.log(`        签名变化: ${d}`);
      console.log(`        注意：哈希变化只能在"有意的物理/基准变更"时接受；提交信息里必须写清为什么。`);
    }
    continue;
  }

  if (!baseline) {
    console.log(`FAIL ${c.id}: 基线缺失 expected=<no-baseline> actual=${r.hash}`);
    console.log(`     dev/checks/golden_baseline.json 不存在 —— 先运行 node dev/checks/golden.mjs --update 生成`);
    hadFailure = true;
    continue;
  }
  if (!rec) {
    if (isAdhoc) {
      console.log(`NOTE ${c.id}: 基线里没有这个临时用例，只打印哈希（可加 --update 收录）`);
      skipped++;
      continue;
    }
    console.log(`FAIL ${c.id}: 基线里没有该用例 expected=<missing> actual=${r.hash}`);
    console.log(`     运行 node dev/checks/golden.mjs --update 把当前结果写进基线`);
    hadFailure = true;
    continue;
  }

  const diffs = signatureDiff(c, rec);
  if (diffs.length > 0) {
    console.log(`FAIL ${c.id}: 基线记录的运行配置与本次不一致 expected=${rec.hash} actual=${r.hash}`);
    for (const d of diffs) console.log(`      ${d}`);
    console.log(`      如属有意变更（例如确实要改帧数），运行 --update 并说明理由。`);
    hadFailure = true;
    continue;
  }

  if (rec.hash === r.hash) {
    console.log(`PASS ${c.id} hash=${r.hash}`);
  } else {
    console.log(`FAIL ${c.id} expected=${rec.hash} actual=${r.hash}`);
    hadFailure = true;
  }
}

if (opts.update) {
  saveBaseline(updated);
  console.log(`\n已写回基线: ${path.relative(ROOT, BASELINE) || BASELINE}`);
  process.exit(0);
}

const passCount = results.filter(({ c, r }) => baseline && baseline[c.id] && baseline[c.id].hash === r.hash && signatureDiff(c, baseline[c.id]).length === 0).length;
console.log(`RESULT: ${hadFailure ? "FAIL" : "PASS"} (${passCount}/${results.length} 用例通过${skipped ? `, ${skipped} 个临时用例未比对` : ""})`);
process.exit(hadFailure ? 1 : 0);
