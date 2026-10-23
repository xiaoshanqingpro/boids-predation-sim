/* ============================================================================
 * 验收判据 3 的多随机种子复核: 固定种子跑长程, 看「雁近」行贪心是否稳定偏向「追雁」
 * 用法:
 *   node _checks/verify_learning.mjs [帧数] [种子数]
 *   node _checks/verify_learning.mjs [帧数] [种子数] EAGLE_DASH_CD=45 EAGLE_DASH_TRIGGER=160 ...
 *     (可选的常量覆盖: 直接改源码文本里的 `const NAME = 数字;`, 用来试参数)
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let code = fs.readFileSync(path.join(here, "..", "掠食竞赛.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const argv = process.argv.slice(2).filter(a => !/^\d+$/.test(a));
const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const FRAMES = nums[0] || 15000;
const SEEDS = nums[1] || 4;

const overrides = [];
for (const a of argv) {
  const [k, v] = a.split("=");
  if (!k || v === undefined) continue;
  const re = new RegExp(`const ${k} = [^;]+;`);
  if (!re.test(code)) { console.error(`✗ 找不到常量 ${k}`); process.exit(1); }
  code = code.replace(re, `const ${k} = ${v};`);
  overrides.push(`${k}=${v}`);
}
if (overrides.length) console.log(`常量覆盖: ${overrides.join(", ")}\n`);

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
function run(seed) {
  const els = new Map();
  const documentStub = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} }, getContext: makeCtx, width: 250, height: 100, addEventListener() {} });
      return els.get(id);
    },
    addEventListener() {},
  };
  const sandbox = { document: documentStub, window: {}, Math: seededMath(seed),
                    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "sim.js" });
  const SIM = sandbox.window.SIM;
  SIM.setGeometry(false);
  for (let i = 0; i < FRAMES; i++) SIM.step();
  const q = SIM.Q, N = 4;
  return {
    goose: SIM.diet[1], starling: SIM.diet[0], falconKills: SIM.kills[0] + SIM.kills[1],
    qGoose: q[3 * N + 1], qStar: q[3 * N + 0],
    pass: q[3 * N + 1] > q[3 * N + 0],
    scores: SIM.scores, eps: SIM.eps,
  };
}

console.log(`验收判据 3 复核: 每粒种子 ${FRAMES} 帧 (${(FRAMES / 60 / 60).toFixed(1)} 分钟仿真), 共 ${SEEDS} 粒\n`);
let pass = 0;
for (let i = 0; i < SEEDS; i++) {
  const seed = 1000 + i * 7919;
  const r = run(seed);
  if (r.pass) pass++;
  console.log(`种子 ${seed}: 雁近 Q(追雁)=${r.qGoose.toFixed(2)} vs Q(追椋)=${r.qStar.toFixed(2)} -> ${r.pass ? "偏向追雁 ✓" : "未偏向 ✗"}` +
              ` | 雁被吃 ${r.goose} / 椋鸟 ${r.starling} | 隼共吃 ${r.falconKills} | 分数 ${r.scores.join("/")}`);
}
console.log(`\n${pass}/${SEEDS} 粒种子通过验收判据 3`);
process.exit(pass >= Math.ceil(SEEDS / 2) ? 0 : 1);
