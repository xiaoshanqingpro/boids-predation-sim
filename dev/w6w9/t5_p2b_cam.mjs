/* T5/W9 阶段 2b: 收尾 —— 删掉阶段2 cutBetween 残留下来的旧 cam 声明 */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = 'const cam = { yaw: 0.7, pitch: 0.52, dist: 950, tx: W / 2, ty: H / 2, tz: Z_INIT, auto: false };   // 【第 8 轮修正⑤】默认不自动转(要转再勾)\n';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 命中 ${n} 次`);
if (!APPLY) { process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { console.log("不写回"); process.exit(1); }
fs.writeFileSync(P, t.split(A).join(""));
console.log("阶段2b 已应用");
