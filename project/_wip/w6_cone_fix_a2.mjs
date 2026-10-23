/* W6 最终口径 A2: inCone3 半径判据 = 水平投影(d2h <= CONE_R), 不再加"垂直 |dz|<=CONE_R"人工带
 * 实测(A1 带 vs A2 无带, 同轨迹 5000 帧): seed 20250101 隼 8 -> 16 帧(29 帧被人工带挡掉);
 * 其余种子 A1==A2。A2 = 只改一个项(d3 -> d2h), 语义 = 锥的平面半径(与渲染/打分口径一致), 角判据仍 3D。
 * 协议: _wip/main.lock -> 编辑 -> syncheck3d -> 释放
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const FILE = "掠食竞赛.html";
const LOCK = "_wip/main.lock";
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

let locked = false;
for (let attempt = 0; attempt < 300; attempt++) {
  try { fs.writeFileSync(LOCK, String(Date.now()), { flag: "wx" }); locked = true; break; }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs > 10 * 60 * 1000) { try { fs.unlinkSync(LOCK); } catch (_) {} continue; }
    sleep(2000);
  }
}
if (!locked) { console.error("✗ 拿不到 _wip/main.lock"); process.exit(2); }
console.log(`[lock] 已持有 ${LOCK}`);

let ok = false;
try {
  const src = fs.readFileSync(FILE, "utf8");
  const oldFn = `  /* 【W6 修回归】半径判据走**水平投影**(锥的平面半径 CONE_R, 与渲染 fan(CONE_R)/perceive 的 2D 锥同一口径);
   * 垂直方向只保留"同一片空域"的 |dz| <= CONE_R 界限。旧写法把 dz 并进半径 -> d3=sqrt(d2h^2+dz^2),
   * 猛禽巡航层抬高后(隼高出猎物层 FALCON_LAYER_OFF=110、雁在 GOOSE_LAYER=280、冲刺俯冲时更低)
   * |dz| 常达 150px, 水平上明明在锥内(d2h=172<180, 角度 cos=0.73>0.5)的猛禽被 d3=231>CONE_R 判出锥外
   * -> 锥内失血整段失效(实测 [1] 段 5000 帧: 2D 锥内 39 帧 / inCone3 命中 0 帧)。
   * 角度判据不变(轴仍随领队垂直速度倾斜), 所以"锥向上翘/向下扣"的语义保留。
   * 守恒线: 关重力时 dz=0, 本式与旧式逐位相同(?grav=0 的物理哈希不变)。 */
  const d2h = dx * dx + dy * dy;
  if (d2h > CONE_R * CONE_R) return false;
  if (dz > CONE_R || dz < -CONE_R) return false;
  const d = Math.sqrt(d2h + dz * dz) || 1;`;
  const newFn = `  /* 【W6 修回归】半径判据走**水平投影**(锥的平面半径 CONE_R; 与渲染的 fan(CONE_R) 和 perceive
   * 打分用的 2D 锥同一口径)。旧写法把 dz 并进半径 -> d3 = sqrt(d2h^2 + dz^2): 三维分层后猛禽与雁
   * 的层差经常 >100px(隼巡航高出猎物层 FALCON_LAYER_OFF=110、雁固定在 GOOSE_LAYER=280、俯冲时更低),
   * 于是水平上明明在锥内的猛禽(实测 d2h=172<180, 平面夹角 cos=0.73>0.5)被 d3=231>CONE_R 判出锥外
   * -> "锥内失血"整段失效: [1] 段 5000 帧里 2D 锥内 39 帧、inCone3 命中 0 帧。
   * 只改半径口径这一项; 角度判据仍用 3D 距离(轴随领队垂直速度倾斜), "锥向上翘/向下扣"语义保留。
   * 守恒线: 关重力时 dz=0 -> d3=d2h, 本式与旧式逐位相同(?grav=0 的物理哈希不变)。 */
  const d2h = dx * dx + dy * dy;
  if (d2h > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2h + dz * dz) || 1;`;
  const n = src.split(oldFn).length - 1;
  if (n !== 1) throw new Error(`A1 版 inCone3 片段命中 ${n} 次(应为 1), 拒绝改动`);
  fs.writeFileSync(FILE, src.replace(oldFn, newFn), "utf8");
  console.log("[edit] inCone3 改为 A2 口径(只改半径项 d3->d2h)");
  const out = execFileSync(process.execPath, ["_checks/syncheck3d.mjs"], { encoding: "utf8" });
  console.log(out.trim());
  if (!/失败=0/.test(out)) throw new Error("syncheck3d 未通过");
  ok = true;
} catch (e) {
  console.error("✗ " + (e && e.message));
} finally { try { fs.unlinkSync(LOCK); console.log("[lock] 已释放"); } catch (_) {} }
console.log(ok ? "APPLY_OK" : "APPLY_FAILED");
process.exit(ok ? 0 : 1);
