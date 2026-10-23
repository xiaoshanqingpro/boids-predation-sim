/* 收尾修补: 去掉 applyHarrierCount 里的 refreshPanel() 主动刷新(无头下会去画面板 canvas) */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const A = '  if (typeof refreshPanel === "function") refreshPanel();\n';
const B = '  // 注: 这里**不主动** refreshPanel() —— 面板每帧由主循环刷新; 主动刷会去画面板 canvas,\n' +
          '  //     在无头 jsdom(getContext 打桩成 null)里会抛 "clearRect of null", 干扰 SIM 钩子调用。\n';
const n = t.split(A).length - 1;
console.log(`${n === 1 ? "✓" : "✗"} 命中 ${n} 次`);
if (!APPLY) { process.exit(n === 1 ? 0 : 1); }
if (n !== 1) { process.exit(1); }
fs.writeFileSync(P, t.split(A).join(B));
console.log("已去掉主动 refreshPanel()");
