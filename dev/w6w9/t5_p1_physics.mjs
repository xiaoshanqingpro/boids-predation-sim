/* ============================================================================
 * T5/W9 阶段 1: 物理层删除 z 轴动力学(对 掠食竞赛_2D.html)
 * ----------------------------------------------------------------------------
 * 原则: 只删/只改写"在 GRAV_ON=false 下永不执行"的代码 —— 因为基线的守恒线就是
 *       (4)?grav=0, 这些路径在基线里同样不执行, 删掉它们不改变 2D 物理语义。
 * 本阶段保留常量与数组声明(下一阶段再删), 这样每一步都能 node --check 通过。
 * 用法: node _w6w9/t5_p1_physics.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛_2D.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);
const del = a => reps.push([a, ""]);

/* ---- 1. initStarlings: 初始高度/垂向速度 ---- */
must(
  '    if (GRAV_ON) {                                       // 守恒线修补: 关重力时不消耗随机数\n' +
  '      ZT[i] = Z_INIT + randn() * Z_SPREAD * ZT_SPREAD_K;   // 个人飞行层(决定云团厚度)\n' +
  '      Z[i] = Math.max(FLOOR_Z + 20, ZT[i]);   // 第 8 轮: 初始云团高度\n' +
  '      VZ[i] = (Math.random() - 0.5) * 0.6;\n' +
  '    } else { Z[i] = 0; VZ[i] = 0; }',
  '    /* 【W9 2D】z 轴已物理删除: 没有初始高度/个人飞行层/垂向速度(也不消耗随机数)。 */'
);

/* ---- 2. inCone3: 去掉三维 ---- */
must(
  'function inCone3(px, py, pz) {\n' +
  '  const dx = minImageX(px - Lx), dy = minImageY(py - Ly), dz = GRAV_ON ? pz - Z2[leaderIdx] : 0;\n',
  'function inCone3(px, py) {                     // 【W9 2D】威慑锥回到纯平面(即原 3D 版在 dz=0 时的退化式)\n' +
  '  const dx = minImageX(px - Lx), dy = minImageY(py - Ly);\n'
);
must(
  '  const d = Math.sqrt(d2h + dz * dz) || 1;\n' +
  '  const az2 = clamp(VZ2[leaderIdx] * 0.25, -0.45, 0.45);\n' +
  '  const al = Math.hypot(1, az2);\n' +
  '  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng) + dz * az2) / (d * al) > CONE_COS;\n' +
  '}',
  '  const d = Math.sqrt(d2h) || 1;\n' +
  '  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng)) / d > CONE_COS;\n' +
  '}'
);

/* ---- 3. 椋鸟吃判: 去掉 3D 球 ---- */
must(
  '      const ez = (GRAV_ON && EAT_3D) ? Z[i] - f.z : 0;                  // 第 8 轮: 3D 判定球\n',
  ''
);
must(
  '      if (ex * ex + ey * ey + ez * ez < EAT_R2_S) {',
  '      if (ex * ex + ey * ey < EAT_R2_S) {          // 【W9 2D】吃判回到纯平面'
);
must(
  '        if (GRAV_ON) spawnCorpse(xi, yi, Z[i], V[vi], V[vi+1], VZ[i]);   // 第 8 轮: 尸体下坠\n',
  ''
);

/* ---- 4. 椋鸟三维逃逸分量 ---- */
must(
  '        if (GRAV_ON) {                       // 第 8 轮: 三维逃逸 —— 高于猛禽往上飞, 低于往下钻\n' +
  '          const dz2 = Z[i] - f.z;\n' +
  '          az += clamp(-dz2 / dp * 1.6 - VZ[i], -0.35, 0.35);\n' +
  '        }\n',
  ''
);

/* ---- 5. 椋鸟 z 动力学(定高弹簧/重力/阻尼) ---- */
must(
  '    if (GRAV_ON) {\n' +
  '      // 【第 8 轮修正】原来弹簧朝"共享的群体均高"且无阻尼, 造成两个可见毛病:\n' +
  '      //   ① 均值回归把相对偏差吃掉 -> 云团慢慢塌成一层(实测 z 标准差 21 -> 4, 看起来"全在一个平面");\n' +
  '      //   ② vz 无阻尼 -> 每只鸟上下无休止振荡(实测 |vz| 一直维持 0.6px/帧)。\n' +
  '      // 现在: 每只鸟有自己的飞行层 ZT[i](厚度永久保留) + 弱群体耦合(整团仍一致)\n' +
  '      //       + 垂向阻尼 ALT_DAMP(把振荡压掉)。\n' +
  '      // 【第 8 轮修正②】鸟要能"主动"改变高度, 不然只是被重力/弹簧摆布, 看起来不会爬升:\n' +
  '      //   ① 个人飞行层缓慢游走(每只鸟自己挑高度, 上下范围 FLOOR+70 ~ Z_CEIL);\n' +
  '      //   ② 惊飞瞬间向上窜(受惊的椋鸟是往上炸开的)。\n' +
  '      ZT[i] = clamp(ZT[i] + (Math.random() - 0.5) * 0.12, FLOOR_Z + 70, Z_CEIL);\n' +
  '      if (startled[i] && VZ[i] < 1.2) VZ[i] += 0.55;\n' +
  '      let az2 = az - G_GRAV + (ZT[i] - Z[i]) * ALT_SPRING + (zMean - Z[i]) * ALT_SPRING * 0.25;\n' +
  '      if (Z[i] < FLOOR_Z + 50) az2 += FLOOR_PUSH;\n' +
  '      VZ[i] = clamp(VZ[i] * ALT_DAMP + az2, -3.2, 3.2);\n' +
  '      Z[i] = Math.max(FLOOR_Z, Z[i] + VZ[i]);\n' +
  '    }\n',
  ''
);

/* ---- 6. 群体均高统计(只服务 z 动力学与相机) ---- */
must(
  '  /* 第 8 轮: 群体均高(定高弹簧用, O(N) 一遍过; 与 xy 完全解耦 -> 2D 轨迹逐位不变) */\n' +
  '  let zSum = 0, zCnt = 0, zLo = 1e9, zHi = -1e9;\n' +
  '  for (let i = 0; i < N; i++) if (alive[i]) {\n' +
  '    zSum += Z[i]; zCnt++;\n' +
  '    if (Z[i] < zLo) zLo = Z[i];\n' +
  '    if (Z[i] > zHi) zHi = Z[i];\n' +
  '  }\n' +
  '  const zMean = zCnt ? zSum / zCnt : Z_INIT;\n' +
  '  zMeanLive = zMean;\n' +
  '  if (zCnt) { zLowLive = zLo; zHighLive = Math.max(zHi, zLo + 30); }   // 三维亮度映射用\n' +
  '\n',
  '  /* 【W9 2D】原来这里统计"群体均高"(定高弹簧/相机/三维亮度用), 已随 z 轴一起删除。 */\n' +
  '\n'
);

/* ---- 7. 雁: 垂向邻居 / 吃判 / z 动力学 ---- */
must(
  '      if (GRAV_ON) VZ2[i] += clamp((Z2[i] - nz) / Math.max(1, d) * 1.5 - VZ2[i], -0.25, 0.25);\n',
  ''
);
must(
  '      const ez = (GRAV_ON && EAT_3D) ? Z2[i] - f.z : 0;                     // 第 8 轮: 3D 判定\n',
  ''
);
must(
  '      if (ex * ex + ey * ey + ez * ez < (gHit ? GH_EAT_R2_G : EAT_R2_G)) {',
  '      if (ex * ex + ey * ey < (gHit ? GH_EAT_R2_G : EAT_R2_G)) {   // 【W9 2D】吃判回到纯平面'
);
must(
  '    if (GRAV_ON) {\n' +
  '      // 雁的分层: 形状弹簧(朝领队层) + 绝对层锚(把领队层拉回 GOOSE_LAYER)。\n' +
  '      // 【修 bug】原式是 (Z2[leaderIdx] + 6 - Z2[i]): 对领队而言目标就是它自己, 净力恒为正\n' +
  '      // -> 整群以 2.5px/帧无限爬升(实测 1500 帧 +3799px)。现在领队被绝对层锚住, 其余雁跟随。\n' +
  '      const az2 = -G_GRAV * 0.8 + (Z2[leaderIdx] - Z2[i]) * ALT_SPRING\n' +
  '                + (GOOSE_LAYER - Z2[leaderIdx]) * ALT_SPRING * 0.8;\n' +
  '      VZ2[i] = clamp(VZ2[i] * ALT_DAMP + az2, -2.5, 2.5);   // 第 8 轮修正: 同样加垂向阻尼\n' +
  '      Z2[i] = Math.max(FLOOR_Z, Z2[i] + VZ2[i]);\n' +
  '    }\n',
  ''
);

/* ---- 8. 尸体系统(纯 z/重力) ---- */
must(
  '/* ---- 第 8 轮: 尸体下坠(被吃的鸟带初速做抛体, 落地停住后消散) ---- */\n' +
  'const CORPSE_CAP = 384;\n' +
  'const cX = new Float32Array(CORPSE_CAP), cY = new Float32Array(CORPSE_CAP), cZ = new Float32Array(CORPSE_CAP);\n' +
  'const cVX = new Float32Array(CORPSE_CAP), cVY = new Float32Array(CORPSE_CAP), cVZ = new Float32Array(CORPSE_CAP);\n' +
  'const cT = new Float32Array(CORPSE_CAP);          // 存活帧数(0 = 空位)\n' +
  'let cCursor = 0;\n' +
  'function spawnCorpse(x, y, z, vx, vy, vz) {\n' +
  '  const k = cCursor;\n' +
  '  cX[k] = x; cY[k] = y; cZ[k] = z; cVX[k] = vx; cVY[k] = vy; cVZ[k] = vz; cT[k] = 1;\n' +
  '  cCursor = (cCursor + 1) % CORPSE_CAP;\n' +
  '}\n' +
  'function stepCorpses() {\n' +
  '  if (!GRAV_ON) return;\n' +
  '  for (let k = 0; k < CORPSE_CAP; k++) {\n' +
  '    if (cT[k] <= 0) continue;\n' +
  '    cT[k]++;\n' +
  '    cVZ[k] -= 0.055;                             // 尸体只受重力(无弹簧)\n' +
  '    cX[k] += cVX[k]; cY[k] += cVY[k]; cZ[k] += cVZ[k];\n' +
  '    if (cZ[k] <= FLOOR_Z) {                      // 落地: 滑动衰减, 停留 60 帧后消散\n' +
  '      cZ[k] = FLOOR_Z; cVX[k] *= 0.8; cVY[k] *= 0.8; cVZ[k] = 0;\n' +
  '      if (cT[k] > 60) cT[k] = 0;\n' +
  '    } else if (cT[k] > 240) cT[k] = 0;\n' +
  '  }\n' +
  '}\n',
  '/* 【W9 2D】尸体下坠(抛体 + 落地)整段删除: 它完全由 z/重力定义(仅 GRAV_ON 时生成), 平面版没有尸体。 */\n'
);
must(
  '  stepCorpses();                             // 第 8 轮: 尸体下坠(与鸟/雁无关, O(常量))\n',
  ''
);

/* ---- 9. tryDash: 三维航向 -> 平面 ---- */
must(
  '  const dz = GRAV_ON ? ((tz === undefined ? f.z : tz) - f.z) : 0;   // 守恒线修补: 关重力必须退化为 2D(dz=0)\n',
  ''
);
must(
  '  const n = Math.sqrt(dx * dx + dy * dy + dz * dz);',
  '  const n = Math.sqrt(dx * dx + dy * dy);           // 【W9 2D】纯平面航向判定'
);
must(
  '  const cvx = f.vx, cvy = f.vy, cvz = GRAV_ON ? f.vz : 0;\n' +
  '  const cn = Math.sqrt(cvx * cvx + cvy * cvy + cvz * cvz) || 1;\n' +
  '  const cosA = (cvx * dx + cvy * dy + cvz * dz) / (cn * n);',
  '  const cvx = f.vx, cvy = f.vy;\n' +
  '  const cn = Math.sqrt(cvx * cvx + cvy * cvy) || 1;\n' +
  '  const cosA = (cvx * dx + cvy * dy) / (cn * n);'
);
must(
  '  f.vz = dz / n * DASH_SPEED;\n',
  ''
);
must(
  '  f.shock = { x: tx, y: ty, z: f.z, t: 0 };      // 冲刺瞬间的冲击波(带高度)',
  '  f.shock = { x: tx, y: ty, t: 0 };              // 【W9 2D】冲刺瞬间的冲击波(平面)'
);

/* ---- 10. 鹰: 垂向 ---- */
must(
  '    if (a === 1 && gi >= 0)      { txp = P2[2*gi];   typ = P2[2*gi+1]; tzp = Z2[gi]; hasT = true; }',
  '    if (a === 1 && gi >= 0)      { txp = P2[2*gi];   typ = P2[2*gi+1]; hasT = true; }   // 【W9 2D】无 tzp'
);
must(
  '      txp = pc.cx; typ = pc.cy; tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 第 8 轮修正: 巡航高于鸟群',
  '      txp = pc.cx; typ = pc.cy; hasT = true;'
);
must(
  '      tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 第 8 轮修正: 游荡伏击站高一层',
  '      hasT = true;'
);
must(
  '        E.vz = clamp((tzp - E.z) * 0.04, -2.5, 2.5);   // 第 8 轮: 冲刺带垂直初速(俯冲/爬升)\n',
  ''
);
must(
  '    if (GRAV_ON && E.dashT > 0) {\n' +
  '      E.vz -= G_GRAV * 0.7;\n' +
  '      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;\n' +
  '    }\n',
  ''
);
must(
  '    const spd = E.dashT > 0 ? EAGLE_DASH + (GRAV_ON ? Math.max(0, -E.vz) * DIVE_BOOST : 0) : EAGLE_CRUISE * slow;',
  '    const spd = E.dashT > 0 ? EAGLE_DASH : EAGLE_CRUISE * slow;   // 【W9 2D】无俯冲红利'
);
must(
  '    if (GRAV_ON) {\n' +
  '      if (E.dashT === 0) {\n' +
  '        // 【第 8 轮修正②】鹰的俯冲相: 有目标且明显高于它时先压机头, 再冲刺(同隼的理由)\n' +
  '      if (hasT && E.dashT === 0 && E.z - tzp > 40) E.stoopT = 10;\n' +
  '      if (E.stoopT > 0) E.stoopT--;\n' +
  '      const dzT = tzp - E.z;\n' +
  '        const des = clamp(dzT / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);\n' +
  '        E.vz += clamp(des - E.vz, -DIVE_RATE, CLIMB_RATE);\n' +
  '      }\n' +
  '      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;\n' +
  '      E.z = Math.max(3, E.z + E.vz);\n' +
  '    }\n',
  ''
);

/* ---- 11. 隼: 巡航目标层 / 俯冲相 / 冲刺垂向 ---- */
must(
  '      const wantZ = pc.lockZ + FALCON_LAYER_OFF * clamp((dPrey - FALCON_HUNT_R) / FALCON_LAYER_RAMP, 0, 1);\n' +
  '      f.targetZ = (f.targetZ < 0) ? wantZ : f.targetZ + (wantZ - f.targetZ) * FALCON_ALT_SLEW;\n',
  ''
);
must(
  '      if (f.stoopT === 0 && f.z - f.targetZ > FALCON_STOOP_DZ && dPrey < 460 && f.energy >= PV_.dashMin) {\n' +
  '        logDec(1, fi, "高空锁定 -> 俯冲相(高于目标层 " + (f.z - f.targetZ).toFixed(0) + "px, 水平 " + dPrey.toFixed(0) + "px)");\n' +
  '        f.stoopT = 10;\n' +
  '      }\n' +
  '      // task-3: 俯冲相期间把目标层一并压到猎物层 —— "承诺式下潜", 10 帧结束后不会再回弹到巡航层\n' +
  '      if (f.stoopT > 0) f.targetZ = pc.lockZ;\n',
  '      /* 【W9 2D】原来的"高空锁定 -> 俯冲相(压机头)"整段删除: 平面版没有高度层差。 */\n'
);
must(
  '    if (f.stoopT > 0) f.stoopT--;\n',
  ''
);
must(
  '      if (GRAV_ON) {\n' +
  '        f.vz -= G_GRAV * 0.7;\n' +
  '        if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;\n' +
  '      }\n',
  ''
);
must(
  '      const effDash = DASH_SPEED + (GRAV_ON ? Math.max(0, -f.vz) * DIVE_BOOST : 0);',
  '      const effDash = DASH_SPEED;                    // 【W9 2D】无俯冲红利'
);
must(
  '    if (GRAV_ON) {\n' +
  '      if (f.dashT === 0) {\n' +
  '        // task-3: 垂向只有一个目标层(俯冲相在上面的 if(pc) 里已把目标层压到猎物层), 且控制器\n' +
  '        // 加了 FALCON_ALT_LEAD 帧的前瞻阻尼: 原来的 pure-P + vz 速率限幅(爬 0.14 / 俯 0.26)\n' +
  '        // 是欠阻尼的 —— 冲过目标层后要 30 帧才能把 vz 反号, 于是自己就摆起来了。\n' +
  '        const tzF = (f.targetZ >= 0) ? f.targetZ : f.z;\n' +
  '        const dzT = tzF - f.z;\n' +
  '        const des = clamp((dzT - FALCON_ALT_LEAD * f.vz) / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);\n' +
  '        f.vz += clamp(des - f.vz, -DIVE_RATE, CLIMB_RATE);\n' +
  '      }\n' +
  '      if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;\n' +
  '      f.z = Math.max(3, f.z + f.vz);\n' +
  '    }\n',
  ''
);

/* ---- 12. 雁隼: 巡航层 / 攻击垂向 ---- */
must(
  '    g.targetZ = baseZ + (canStrike ? GH_LAYER_OFF * clamp((dT - 200) / 300, 0, 1) : 0);\n',
  '    /* 【W9 2D】原来还有 g.targetZ(巡航高于目标层 GH_LAYER_OFF=90), 已随 z 轴删除。 */\n'
);
must(
  '      if (sc > tsc) { tsc = sc; ti = j; td = d; txg = P2[2*j]; tyg = P2[2*j+1]; tzg = Z2[j]; }',
  '      if (sc > tsc) { tsc = sc; ti = j; td = d; txg = P2[2*j]; tyg = P2[2*j+1]; }'
);
must(
  '        aimZ = Z2[g.homeGoose];\n',
  ''
);
must(
  '      if (GRAV_ON) {\n' +
  '        g.vz -= G_GRAV * 0.7;\n' +
  '        if (g.z < GROUND_MARGIN && g.vz < 0.3) g.vz = 0.3;\n' +
  '      }\n',
  ''
);
must(
  '      const eff = GH_DASH_SPEED + (GRAV_ON ? Math.max(0, -g.vz) * DIVE_BOOST : 0);',
  '      const eff = GH_DASH_SPEED;                     // 【W9 2D】无俯冲红利'
);
must(
  '      if (GRAV_ON) {                           // 垂直方向也归航(限幅 ×2)\n' +
  '        const dzA = aimZ - g.z;\n' +
  '        const wantVz = clamp(dzA * 0.06, -GH_DIVE_RATE * 2, GH_CLIMB_RATE * 2);\n' +
  '        g.vz += clamp(wantVz - g.vz, -GH_DIVE_RATE, GH_CLIMB_RATE);\n' +
  '      }\n',
  ''
);
must(
  '    if (GRAV_ON) {                             // 守恒线: 关重力时这一段完全不执行\n' +
  '      if (g.dashT === 0) {\n' +
  '        const dzT = g.targetZ - g.z;\n' +
  '        const des = clamp(dzT / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);\n' +
  '        g.vz += clamp(des - g.vz, -GH_DIVE_RATE, g.stall > 0 ? 0 : GH_CLIMB_RATE);   // 垂向限幅 ×2(高机动); W5 失速段禁爬升\n' +
  '      }\n' +
  '      if (g.z < GROUND_MARGIN && g.vz < 0.3) g.vz = 0.3;\n' +
  '      g.z = Math.max(3, g.z + g.vz);\n' +
  '    }\n',
  ''
);
must(
  '            g.vx *= kk; g.vy *= kk; g.vz *= kk;',
  '            g.vx *= kk; g.vy *= kk;            // 【W9 2D】无垂向分量'
);

/* ---- 13. 雁群/猛禽工厂与重置: 去掉 z 字段 ---- */
must(
  '           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 第 8 轮: 3D 拖尾\n' +
  '           shock: null, seeing: false,\n' +
  '           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0 };',
  '           shock: null, seeing: false,\n' +
  '           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0 };   // 【W9 2D】无 trailBuf(z 拖尾已删)'
);

/* ---- 14. ghunter bandit 的"相对高度"状态: 纯 2D 下恒为 0(贴层飞行) ---- */
must(
  'function ghunterBanditHigh(g) { return (galiveCount > 0 && g.z - Z2[leaderIdx] > GH_BANDIT_HIGH_PX) ? 1 : 0; }',
  '/* 【W9 2D】bandit 的"自身是否高于雁层"状态: 平面版没有高度 -> 恒为 0(贴层)。\n' +
  ' * 保留函数与状态位, 只是这个上下文永远取 0; UCB1 仍按"雁群是否混乱"这一个状态学。 */\n' +
  'function ghunterBanditHigh(g) { return 0; }'
);

let bad = 0;
reps.forEach(([a], i) => { const n = t.split(a).length - 1; if (n !== 1) bad++; console.log(`${n === 1 ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 (${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 56)}`); });
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T5 阶段1 已应用: ${reps.length} 处`);
