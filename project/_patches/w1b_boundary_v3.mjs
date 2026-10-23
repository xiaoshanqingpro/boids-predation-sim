/* ============================================================================
 * task-6 (W1b) 加固补丁 v3: 让"到边界最近距离"有充足余量(实测猛禽曾到 45.1px, 阈值 40px)
 * ----------------------------------------------------------------------------
 * 根因: ① 朝外速度削减比例是线性 ramp, pen=0.89 时才 0.93 —— 贴边仍有少量朝外泄漏,
 *          加上猛禽每帧被重新归一化到巡航速度, 残余朝外分量会被放大回全速;
 *       ② 冲刺边界余量 40px 与验收阈值同一量级, 一个"起点就在 45px"的切向冲刺就能贴到线。
 * 处置: ① 削减比例改 2× ramp: pen ≥ 0.5(离边 210px) 就饱和到 1.0 —— 带内侧"朝外分量
 *          恒被削光", 个体只能切向滑走 + 被力缓慢推回, 巡航时根本进不了 210px;
 *       ② DASH_BOUND_MARGIN 40 -> 90(冲刺整条直线路径都留在 90px 内), SPAWN_MARGIN 90 -> 130。
 * 用法: node _patches/w1b_boundary_v3.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);

must(
  'const BOUND_CUT_LO = 0.35;               // 朝外速度削减比例下限(pen→0); pen→1 时升到 1.0\n' +
  'const DASH_BOUND_LOOK = 45;              // 冲刺边界预测帧数上限\n' +
  'const DASH_BOUND_MARGIN = 40;            // 预测预警余量(px): 预测点进入这个带内即视为会出界',
  'const BOUND_CUT_LO = 0.35;               // 朝外速度削减比例下限(pen→0)\n' +
  'const BOUND_CUT_K = 2.0;                 // 削减比例的 ramp 倍率: pen ≥ 1/K(离边 210px) 时饱和到 1.0\n' +
  'const DASH_BOUND_LOOK = 45;              // 冲刺边界预测帧数上限\n' +
  'const DASH_BOUND_MARGIN = 90;            // 预测预警余量(px): 冲刺整条直线路径都留在世界边内这么多'
);

must(
  '  const p = Math.min(pen, 1);                                     // pen>1(世界外)时不再加码\n' +
  '  const F = Math.min(BOUND_F_MAX * k, BOUND_FORCE * k * p * p);   // 二次 ramp + 饱和\n' +
  '  return [nX / m, nY / m, F, BOUND_CUT_LO + (1 - BOUND_CUT_LO) * p];',
  '  const p = Math.min(pen, 1);                                     // pen>1(世界外)时不再加码\n' +
  '  const F = Math.min(BOUND_F_MAX * k, BOUND_FORCE * k * p * p);   // 二次 ramp + 饱和\n' +
  '  const pc = Math.min(p * BOUND_CUT_K, 1);                        // 削减比例: pen ≥ 0.5 起恒为 1.0\n' +
  '  return [nX / m, nY / m, F, BOUND_CUT_LO + (1 - BOUND_CUT_LO) * pc];'
);

must(
  'const SPAWN_MARGIN = 90;                       // 出生点离世界四边至少留这么多(> DASH_BOUND_MARGIN)',
  'const SPAWN_MARGIN = 130;                      // 出生点离世界四边至少留这么多(> DASH_BOUND_MARGIN)'
);

let bad = 0;
reps.forEach(([a], i) => {
  const n = t.split(a).length - 1;
  if (n !== 1) bad++;
  console.log(`${n === 1 ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 (锚点 ${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 62)}`);
});
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式, 未写文件)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("有锚点未命中/重复 —— 不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`task-6 加固补丁 v3 已应用: ${reps.length} 处`);
