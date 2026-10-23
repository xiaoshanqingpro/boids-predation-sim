/* W6 修复: inCone3 半径判据由 3D 距离改为水平投影(垂直保留 |dz| <= CONE_R 同一空域界限)
 * 协议: _wip/main.lock 写互斥(占用则 2s 重试; mtime > 10 分钟可抢占) -> 编辑 -> syncheck3d -> 释放
 * 用法: node _wip/w6_cone_fix_apply.mjs
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const FILE = "掠食竞赛.html";
const LOCK = "_wip/main.lock";
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// ---- 取锁 ----
let locked = false;
for (let attempt = 0; attempt < 300; attempt++) {
  try { fs.writeFileSync(LOCK, String(Date.now()), { flag: "wx" }); locked = true; break; }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs > 10 * 60 * 1000) {
      console.log(`[lock] 发现陈旧锁(mtime ${new Date(st.mtimeMs).toISOString()}), 抢占`);
      try { fs.unlinkSync(LOCK); } catch (_) {}
      continue;
    }
    if (attempt % 5 === 0) console.log(`[lock] 被占用, 重试中... (${attempt})`);
    sleep(2000);
  }
}
if (!locked) { console.error("✗ 拿不到 _wip/main.lock, 放弃"); process.exit(2); }
console.log(`[lock] 已持有 ${LOCK}`);

let ok = false;
try {
  const src = fs.readFileSync(FILE, "utf8");
  const oldFn = `function inCone3(px, py, pz) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly), dz = GRAV_ON ? pz - Z2[leaderIdx] : 0;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2) || 1;
  const az2 = clamp(VZ2[leaderIdx] * 0.25, -0.45, 0.45);
  const al = Math.hypot(1, az2);
  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng) + dz * az2) / (d * al) > CONE_COS;
}`;
  const newFn = `function inCone3(px, py, pz) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly), dz = GRAV_ON ? pz - Z2[leaderIdx] : 0;
  /* 【W6 修回归】半径判据走**水平投影**(锥的平面半径 CONE_R, 与渲染 fan(CONE_R)/perceive 的 2D 锥同一口径);
   * 垂直方向只保留"同一片空域"的 |dz| <= CONE_R 界限。旧写法把 dz 并进半径 -> d3=sqrt(d2h^2+dz^2),
   * 猛禽巡航层抬高后(隼高出猎物层 FALCON_LAYER_OFF=110、雁在 GOOSE_LAYER=280、冲刺俯冲时更低)
   * |dz| 常达 150px, 水平上明明在锥内(d2h=172<180, 角度 cos=0.73>0.5)的猛禽被 d3=231>CONE_R 判出锥外
   * -> 锥内失血整段失效(实测 [1] 段 5000 帧: 2D 锥内 39 帧 / inCone3 命中 0 帧)。
   * 角度判据不变(轴仍随领队垂直速度倾斜), 所以"锥向上翘/向下扣"的语义保留。
   * 守恒线: 关重力时 dz=0, 本式与旧式逐位相同(?grav=0 的物理哈希不变)。 */
  const d2h = dx * dx + dy * dy;
  if (d2h > CONE_R * CONE_R) return false;
  if (dz > CONE_R || dz < -CONE_R) return false;
  const d = Math.sqrt(d2h + dz * dz) || 1;
  const az2 = clamp(VZ2[leaderIdx] * 0.25, -0.45, 0.45);
  const al = Math.hypot(1, az2);
  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng) + dz * az2) / (d * al) > CONE_COS;
}`;
  const n = src.split(oldFn).length - 1;
  if (n !== 1) throw new Error(`inCone3 旧文本命中 ${n} 次(应为 1), 拒绝改动`);
  fs.writeFileSync(FILE, src.replace(oldFn, newFn), "utf8");
  console.log("[edit] inCone3 已替换: 半径 d3 -> 水平 d2h + |dz|<=CONE_R 带");

  const out = execFileSync(process.execPath, ["_checks/syncheck3d.mjs"], { encoding: "utf8" });
  console.log(out.trim());
  if (!/失败=0/.test(out)) throw new Error("syncheck3d 未通过");
  ok = true;
} catch (e) {
  console.error("✗ " + (e && e.message));
} finally {
  try { fs.unlinkSync(LOCK); console.log("[lock] 已释放"); } catch (_) {}
}
console.log(ok ? "APPLY_OK" : "APPLY_FAILED");
process.exit(ok ? 0 : 1);
