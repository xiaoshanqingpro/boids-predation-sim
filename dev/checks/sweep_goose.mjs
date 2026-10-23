/* ============================================================================
 * 参数扫描: 验收判据 3(「雁近」行贪心应偏向「追雁」)对雁的判定半径有多敏感?
 * 逐个组合跑长程仿真, 报告: 雁被吃次数 / 鹰的食谱 / 雁近行 Q(追雁) vs Q(追椋)
 * 用法: node _checks/sweep_goose.mjs [每格帧数]
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "掠食竞赛.html");
const base = fs.readFileSync(file, "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const FRAMES = Number(process.argv[2] || 18000);

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
function run(code) {
  const els = new Map();
  const documentStub = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, { id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, classList: { toggle() {} }, getContext: makeCtx, width: 250, height: 100, addEventListener() {} });
      return els.get(id);
    },
    addEventListener() {},
  };
  const sandbox = { document: documentStub, window: {}, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "sim.js" });
  const SIM = sandbox.window.SIM;
  SIM.setGeometry(false);
  const N = 4;
  for (let i = 0; i < FRAMES; i++) SIM.step();
  const q = SIM.Q, k = SIM.kills, diet = SIM.diet;
  const g4 = q[3 * N + 1], g0 = q[3 * N + 0];
  let maxQ = 0;
  for (const v of q) maxQ = Math.max(maxQ, v);
  return { gooseKills: diet[1], starlingKills: diet[0], falconKills: k[0] + k[1], eagleKills: k[2],
           qChaseGoose: g4, qChaseStar: g0, pass: g4 > g0, maxQ, scores: SIM.scores,
           missEagle: SIM.stats.missEagle, clashes: SIM.stats.clashes, mobInt: SIM.stats.mobInterrupts };
}

const configs = [
  { name: "R_G=12 (F 规格值), MISS_EAGLE=2", patch: c => c.replace("const EAT_R2_G = 12 * 12;", "const EAT_R2_G = 12 * 12;") },
  { name: "R_G=14,                 MISS_EAGLE=2", patch: c => c.replace("const EAT_R2_G = 12 * 12;", "const EAT_R2_G = 14 * 14;") },
  { name: "R_G=15 (整合前值),      MISS_EAGLE=2", patch: c => c.replace("const EAT_R2_G = 12 * 12;", "const EAT_R2_G = 15 * 15;") },
];

console.log(`每个组合跑 ${FRAMES} 帧 (${(FRAMES / 60 / 60).toFixed(1)} 分钟仿真)\n`);
for (const cfg of configs) {
  const code = cfg.patch(base);
  if (!/const MISS_PENALTY_EAGLE = 2;/.test(code)) console.log("  (注意: MISS_PENALTY_EAGLE 不是 2)");
  const t = performance.now();
  const r = run(code);
  console.log(`${cfg.name}`);
  console.log(`   雁被吃 ${r.gooseKills} (鹰)  |  鹰吃椋鸟 ${r.starlingKills}  |  隼共吃 ${r.falconKills}  |  分数 ${r.scores.join("/")}`);
  console.log(`   雁近行 Q(追雁)=${r.qChaseGoose.toFixed(2)}  Q(追椋)=${r.qChaseStar.toFixed(2)}  -> ${r.pass ? "偏向追雁 ✓" : "未偏向 ✗"}  |  maxQ=${r.maxQ.toFixed(1)}  空冲刺(鹰)${r.missEagle}  互攻${r.clashes}  围攻打断${r.mobInt}`);
  console.log(`   (耗时 ${((performance.now() - t) / 1000).toFixed(0)}s)\n`);
}
