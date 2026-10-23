/* W6: 生成 _wip/w6_scratch_pre.html —— 从**修复后**主文件回退 inCone3 到修复前版本(仅用于配对对照) */
import fs from "node:fs";
const NEWFN = `  /* 【W6 修回归】半径判据走**水平投影**(锥的平面半径 CONE_R, 与渲染 fan(CONE_R)/perceive 的 2D 锥同一口径);
   * 垂直方向只保留"同一片空域"的 |dz| <= CONE_R 界限。旧写法把 dz 并进半径 -> d3=sqrt(d2h^2+dz^2),
   * 猛禽巡航层抬高后(隼高出猎物层 FALCON_LAYER_OFF=110、雁在 GOOSE_LAYER=280、冲刺俯冲时更低)
   * |dz| 常达 150px, 水平上明明在锥内(d2h=172<180, 角度 cos=0.73>0.5)的猛禽被 d3=231>CONE_R 判出锥外
   * -> 锥内失血整段失效(实测 [1] 段 5000 帧: 2D 锥内 39 帧 / inCone3 命中 0 帧)。
   * 角度判据不变(轴仍随领队垂直速度倾斜), 所以"锥向上翘/向下扣"的语义保留。
   * 守恒线: 关重力时 dz=0, 本式与旧式逐位相同(?grav=0 的物理哈希不变)。 */
  const d2h = dx * dx + dy * dy;
  if (d2h > CONE_R * CONE_R) return false;
  if (dz > CONE_R || dz < -CONE_R) return false;`;
const OLDBODY = `  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > CONE_R * CONE_R) return false;`;
const NEWD = `  const d = Math.sqrt(d2h + dz * dz) || 1;`;
const OLDD = `  const d = Math.sqrt(d2) || 1;`;
const t = fs.readFileSync("掠食竞赛.html", "utf8");
const n = t.split(NEWFN).length - 1;
if (n !== 1) throw new Error("修复后 inCone3 片段命中 " + n + " 次(应为 1)");
const out = t.replace(NEWFN, OLDBODY);
if (out.split(NEWD).length - 1 !== 1) throw new Error("d2h 行未命中");
const out1 = out.replace(NEWD, OLDD);
// 同时保留 SIM 调试导出(与 scratch 相同)
const anchor = "window.SIM = {";
const i = out1.indexOf(anchor);
const add = `window.SIM = {
  inCone3,
  __coneCtx() { return { Lx, Ly, leaderAng, leaderZ: Z2[leaderIdx], leaderVZ: VZ2[leaderIdx],
                         R: CONE_R, COS: CONE_COS, grav: GRAV_ON, apexIdx: leaderIdx, galiveCount }; },
`;
const out2 = out1.slice(0, i) + add + out1.slice(i + anchor.length);
fs.writeFileSync("_wip/w6_scratch_pre.html", out2);
console.log("pre-scratch written", out2.length);
