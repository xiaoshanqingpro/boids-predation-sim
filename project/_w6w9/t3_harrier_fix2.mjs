/* T3/W8 修正 2: "蒸发"语义修正 —— score 为负时不能因为"扣 5%"反而加分。
 * 规格: score −= 当前分×5%（分蒸发）; 当前分为负时(空冲刺罚款累积) 5% 是负的,
 * 直接相减等于给目标"回血"。改成按 max(0, 当前分) 蒸发。
 * 用法: node _w6w9/t3_harrier_fix2.mjs [--apply] */
import fs from "node:fs";
const P = "掠食竞赛(4).html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = '      const burned = T.score * frac;              // 蒸发: 直接扣掉, 不进任何人的口袋';
const B = '      const burned = Math.max(0, T.score) * frac; // 蒸发: 只从"正分"里蒸发(当前分为负时相减等于回血),\n' +
          '                                                  // 且直接扣掉不进任何人的口袋';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 锚点命中 ${n} 次`);
if (!APPLY) { console.log("(体检模式)"); process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { console.log("不写回"); process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B));
console.log("T3 修正 2 已应用");
