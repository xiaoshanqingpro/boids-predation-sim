/* ============================================================================
 * task-6 (W1b) 收尾补丁 v4: DASH_BOUND_MARGIN 90 -> 40（Lead 裁决 = B）
 * ----------------------------------------------------------------------------
 * 实测依据(每档 3 个独立进程 × 5000 帧, setRefill(false), 边界探针逐帧):
 *   M=90(接手版) 总捕获 90/104/105/83/118/73 均值 95.5  | 探针 PASS×3, 猛禽到边 214~343px, 越界 0, clamp 0
 *   M=60         总捕获 123/98/164           均值 128.3 | 探针 PASS×3, 猛禽到边 240.1px,   越界 0, clamp 0
 *   M=40         总捕获 137/139/123          均值 133.0 | 探针 PASS×3, 猛禽到边 221.9px,   越界 0, clamp 0
 * 三档边界安全性实测相同 —— 真正防越界的是 boundAversion 里"pen≥0.5 时朝外速度削减比例
 * 饱和到 1.0"(v3), DASH_BOUND_MARGIN 只决定"贴边时拒发冲刺"的次数。收到 40 是减少无谓否决。
 * 用法: node _patches/w1b_boundary_v4.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = 'const DASH_BOUND_MARGIN = 90;            // 预测预警余量(px): 冲刺整条直线路径都留在世界边内这么多';
const B = 'const DASH_BOUND_MARGIN = 40;            // 预测预警余量(px): 冲刺整条直线路径都留在世界边内这么多';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 锚点命中 ${n} 次: ${A.slice(0, 50)}`);
if (!APPLY) { console.log("(体检模式, 未写文件)"); process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { console.log("锚点异常 —— 不写回"); process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B));
console.log("task-6 v4 已应用: DASH_BOUND_MARGIN 90 -> 40");
