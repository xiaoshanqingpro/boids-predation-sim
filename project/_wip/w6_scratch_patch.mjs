/* W6: 生成 _wip/w6_scratch.html —— 主文件的只读诊断副本(仅新增 SIM 调试导出, 不改逻辑) */
import fs from "node:fs";
const src = fs.readFileSync("掠食竞赛.html", "utf8");
const anchor = "window.SIM = {";
const i = src.indexOf(anchor);
if (i < 0) throw new Error("找不到 window.SIM 导出块");
const add = `window.SIM = {
  /* W6 诊断注入(不改变任何行为) */
  inCone3,
  __coneCtx() { return { Lx, Ly, leaderAng, leaderZ: Z2[leaderIdx], leaderVZ: VZ2[leaderIdx],
                         R: CONE_R, COS: CONE_COS, grav: GRAV_ON, apexIdx: leaderIdx, galiveCount }; },
  __setLeader(a) { leaderAng = a; },
`;
const out = src.slice(0, i) + add + src.slice(i + anchor.length);
fs.writeFileSync("_wip/w6_scratch.html", out);
console.log("scratch written", out.length);
