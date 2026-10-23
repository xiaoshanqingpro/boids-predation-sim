/* ============================================================================
 * T3 / W8: 驱逐鸟新物种 harrier —— 施工文档 `掠食竞赛_W6-W9_施工prompt.md` T3 节
 * ----------------------------------------------------------------------------
 * 只改 `掠食竞赛(4).html`。所有锚点必须**恰好命中一次**, 否则整体不写回。
 * 落地四件套: 常量区注释 / stats 计数 / SIM 钩子 / 面板行 (+ 小地图点 + cbHarrier)。
 * 用法: node _w6w9/t3_harrier_patch.mjs [--apply]
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛(4).html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const must = (a, b) => reps.push([a, b]);

/* ---------------- 1. 常量区 ---------------- */
must(
  'const ghunters = [];                           // 雁隼数组(默认 0 只, 面板/接口加入)',
  '/* ============================================================================\n' +
  ' * W8 新物种: 驱逐鸟 harrier(现实原型: 必胜鸟 / 贼鸥) —— 纯负外部性物种\n' +
  ' * ----------------------------------------------------------------------------\n' +
  ' * 生态位: 自己不吃任何东西、也不被捕食 —— 它们**不进 threats**(所以鸟群不因它逃逸、\n' +
  ' *   6.4/6.5 的 EAT 判定完全不涉及它们、6.10 互攻也不参与), 只做一件事:\n' +
  ' *   追着"当前得分最高的猛禽"骚扰, 把领先者按回去 —— 不进食物网, 只给负外部性。\n' +
  ' *   · 点名: 每 HARRIER_LOCK_FRAMES=60 帧重选一次目标 = 当时 score 最高的 raptor(天然追分);\n' +
  ' *   · 压力: 目标 120px 内每帧 +1 层(上限 30) -> 目标转向类参数 ×(1-0.02L)、冲刺能耗 ×(1+0.03L);\n' +
  ' *   · 俯冲: 层满 30 且有"就绪"个体在带内 -> 目标 stun +12 帧、score 蒸发当前分 5%\n' +
  ' *     (分蒸发: 直接从目标 score 扣掉, 不进任何人的口袋); 俯冲者自身 20 帧 ×0.6 速 = 猛禽反杀窗口;\n' +
  ' *   · 反制: 猛禽**冲刺中**撞到 -> 驱逐鸟死亡(不给分), 60 帧后在椋鸟群质心外 300px 重生;\n' +
  ' *     非冲刺撞上 -> 双方弹开(复用 6.10 的击退几何 CLASH_KNOCK 口径, 不眩晕不扣分);\n' +
  ' *   · 贼鸥模式(默认开): 目标在 30 帧内刚得过分的窗口里, 蒸发比例 5% -> 15%。\n' +
  ' * 速度 HARRIER_SPEED=6.0: 快过默认编制里的一切猛禽巡航(隼 CIRCLE_SPEED=5.0 / 鹰 EAGLE_CRUISE=5.8);\n' +
  ' *   雁隼 GH_CRUISE_SPEED=6.5 是"默认 0 只"的可选物种, 以施工文档给定的 6.0 为准。\n' +
  ' * 随机数纪律: 出生/重生/环绕全部用确定性角度(黄金角递推), 热路径**不消耗 Math.random**\n' +
  ' *   -> 与"无驱逐鸟"对照组共用同一条随机数流, 是干净的配对 A/B。\n' +
  ' * ========================================================================== */\n' +
  'const HARRIER_N = 6;                       // 编制 6 只(常驻数组; 阵亡只置标记 -> 存活数恒 0~6)\n' +
  'const HARRIER_SPEED = 6.0;                 // 巡航速度(px/帧)\n' +
  'const HARRIER_MAX_TURN = 0.14;             // 每帧转艏上限(rad): 比隼盘旋 0.07 灵活, 但仍有限\n' +
  'const HARRIER_COLOR = "90,220,180";        // 青绿\n' +
  'const HARRIER_ORBIT_R = 90;                // 环绕点半径(px): < 压力半径 120 -> 能持续堆压力\n' +
  'const HARRIER_ORBIT_W = 0.045;             // 环绕角速度(rad/帧)\n' +
  'const HARRIER_LOCK_FRAMES = 60;            // 点名周期(帧)\n' +
  'const HARRIER_RANGE = 120;                 // 压力半径(px)\n' +
  'const HARRIER_RANGE2 = HARRIER_RANGE * HARRIER_RANGE;\n' +
  'const HARRIER_LAYER_MAX = 30;              // 压力层数上限\n' +
  'const HARRIER_TURN_PEN = 0.02;             // 每层: 转向类参数 ×(1-0.02L)\n' +
  'const HARRIER_DRAIN_PEN = 0.03;            // 每层: 冲刺能耗 ×(1+0.03L)\n' +
  'const HARRIER_DIVE_STUN = 12;              // 俯冲给目标的眩晕帧数\n' +
  'const HARRIER_DIVE_BURN = 0.05;            // 俯冲蒸发当前分的比例\n' +
  'const HARRIER_SKUA_BURN = 0.15;            // 贼鸥模式: 目标刚得过分 -> 蒸发 15%\n' +
  'const HARRIER_SKUA_WINDOW = 30;            // "刚得分"窗口(帧)\n' +
  'const HARRIER_RECOVER = 20;                // 俯冲后自身恢复帧数(猛禽反杀窗口)\n' +
  'const HARRIER_RECOVER_SPEED = 0.6;         // 恢复期速度倍率\n' +
  'const HARRIER_RESPAWN_FRAMES = 60;         // 阵亡后重生延迟(帧)\n' +
  'const HARRIER_RESPAWN_R = 300;             // 重生点: 椋鸟群质心外 300px\n' +
  'const HARRIER_HIT_R = 16;                  // 与猛禽的碰撞半径(px): 必须 > 单帧位移(隼冲刺 8.5)\n' +
  'const HARRIER_HIT_R2 = HARRIER_HIT_R * HARRIER_HIT_R;\n' +
  'const HARRIER_KNOCK = 11;                  // 非冲刺相撞的击退距离(与 CLASH_KNOCK 同口径)\n' +
  'const HARRIER_BUMP_CD = 30;                // 同一只的"弹开"冷却(帧): 防逐帧抖\n' +
  'const HARRIER_Z = 150;                     // 飞行高度(与鹰同层: 不与鸟群/雁群层混淆)\n' +
  '\n' +
  'const ghunters = [];                           // 雁隼数组(默认 0 只, 面板/接口加入)'
);

/* ---------------- 2. 数组 / 工厂 / 压力 / 俯冲 / 反制 ---------------- */
must(
  'let eagle = eagles[0] || null;                 // 【第 8 轮修正】原为 const 别名: 鹰减到 0 再补一只后,',
  '/* ---- W8 驱逐鸟: 状态 + 工厂 + 压力层数 + 点名/俯冲/反制 ---- */\n' +
  'const harriers = [];                        // 常驻 HARRIER_N 只; dead>0 = 阵亡计时中(数组长度不变)\n' +
  'let harrierOn = true;                       // cbHarrier 开关(默认开; 验收对照组 = 关)\n' +
  'let HARRIER_SKUA_ON = true;                 // 贼鸥模式(规格 T3 第 6 条, 默认开)\n' +
  'let harrierTarget = null;                   // 当前点名的猛禽(每 60 帧重选 = 当时 score 最高者)\n' +
  'let harrierRespawnSeq = 0;                  // 重生方位的确定性递推(黄金角; 不消耗 Math.random)\n' +
  'let harrierSkuaHits = 0;                    // 贼鸥模式生效次数(取证)\n' +
  '\n' +
  'function makeHarrier(x, y, i) {\n' +
  '  return { x, y, z: HARRIER_Z, vx: 0, vy: 0, kind: "harrier",\n' +
  '           color: HARRIER_COLOR, label: "驱逐鸟" + (CN_NUM[i] || ("#" + (i + 1))),\n' +
  '           slot: i, orbitA: (i / HARRIER_N) * TAU, dead: 0, recover: 0, bumpCd: 0, dives: 0,\n' +
  '           memX: x, memY: y, memT: -1e9, score: 0, kills: 0 };\n' +
  '}\n' +
  '/* 压力层数挂在猛禽对象上(惰性初始化): 不改 makeFalcon/makeEagle/makeGooseHunter 的构造,\n' +
  ' * 减少与 T1/T2 施工的写冲突; 层数只由 hLayerSet 维护, 因此恒在 [0, HARRIER_LAYER_MAX]。 */\n' +
  'function hLayerOf(r) { return r.hLayer === undefined ? 0 : r.hLayer; }\n' +
  'function hLayerSet(r, v) { r.hLayer = v <= 0 ? 0 : (v >= HARRIER_LAYER_MAX ? HARRIER_LAYER_MAX : v); return r.hLayer; }\n' +
  'function hTurnPen(r) { return 1 - HARRIER_TURN_PEN * hLayerOf(r); }     // 转向类参数倍率(≥0.4)\n' +
  'function hDrainPen(r) { return 1 + HARRIER_DRAIN_PEN * hLayerOf(r); }   // 冲刺能耗倍率(≤1.9)\n' +
  'function harrierAliveCount() { let c = 0; for (let i = 0; i < harriers.length; i++) if (harriers[i].dead === 0) c++; return c; }\n' +
  '\n' +
  '// 回到出生编制: 世界内、鸟群质心附近的错开方位(与猛禽出生同一套 spawnPoint 口径)\n' +
  'function resetHarriers() {\n' +
  '  harriers.length = 0;\n' +
  '  for (let i = 0; i < HARRIER_N; i++) {\n' +
  '    const p = spawnPoint(Math.PI * 0.7 + i * TAU / HARRIER_N, RAPTOR_HOME_R);\n' +
  '    harriers.push(makeHarrier(p.x, p.y, i));\n' +
  '  }\n' +
  '  harrierTarget = null; harrierRespawnSeq = 0; harrierSkuaHits = 0;\n' +
  '  for (let i = 0; i < raptors.length; i++) { const r = raptors[i]; r.hLayer = 0; r.hGainT = -1e9; r.hScorePrev = r.score; }\n' +
  '}\n' +
  '\n' +
  'function respawnHarrier(h) {\n' +
  '  harrierRespawnSeq++;\n' +
  '  const ang = harrierRespawnSeq * 2.399963229728653;      // 黄金角: 每次方位错开, 且不消耗随机数\n' +
  '  const p = spawnPoint(ang, HARRIER_RESPAWN_R);           // 椋鸟群质心外 300px\n' +
  '  h.x = p.x; h.y = p.y; h.z = HARRIER_Z; h.vx = 0; h.vy = 0;\n' +
  '  h.orbitA = ang; h.dead = 0; h.recover = 0; h.bumpCd = 0; h.memX = p.x; h.memY = p.y; h.memT = frame;\n' +
  '  logDec(8, 200 + h.slot, "重生: 椋鸟群质心外 " + HARRIER_RESPAWN_R + "px(第 " + harrierRespawnSeq + " 次)");\n' +
  '}\n' +
  '\n' +
  '// 开关(面板 cbHarrier / SIM.setHarrier): 关 = 对照组, 同时清掉猛禽身上的残余压力\n' +
  'function setHarrierOn(v) {\n' +
  '  harrierOn = !!v;\n' +
  '  const cb = el("cbHarrier"); if (cb) cb.checked = harrierOn;\n' +
  '  for (let i = 0; i < raptors.length; i++) {\n' +
  '    if (harrierOn) raptors[i].hScorePrev = raptors[i].score;\n' +
  '    else raptors[i].hLayer = 0;\n' +
  '  }\n' +
  '  if (!harrierOn) harrierTarget = null;\n' +
  '  return harrierOn;\n' +
  '}\n' +
  '\n' +
  'function harrierLineText() {\n' +
  '  if (!harrierOn) return "已关闭（对照口径: 无驱逐鸟）";\n' +
  '  const T = harrierTarget;\n' +
  '  return "存活 " + harrierAliveCount() + "/" + HARRIER_N + " · 俯冲 " + stats.harrierDives +\n' +
  '         " 次 · 蒸发 " + stats.harrierScoreBurned.toFixed(1) + " 分" +\n' +
  '         (harrierSkuaHits ? "(贼鸥 " + harrierSkuaHits + ")" : "") +\n' +
  '         " · 撞落 " + stats.harrierDowns + " · 弹开 " + stats.harrierBumps +\n' +
  '         (T ? " · 点名 " + T.label.split(" ")[0] + " 层 " + hLayerOf(T) + "/" + HARRIER_LAYER_MAX : " · 无目标");\n' +
  '}\n' +
  '\n' +
  '/* 每帧: 点名 -> 压力 -> 俯冲 -> 环绕移动 -> 反制。\n' +
  ' * 【顺序要紧】这一节排在 6.3 之前(见 stepRest): 压力层必须先于 6.6 鹰 / 6.8 隼 / 6.85 雁隼\n' +
  ' * 的受力与能耗公式算好, 否则 debuff 会慢一帧。 */\n' +
  'function harrierStep() {\n' +
  '  // ① 点名: 每 60 帧重选"当前 score 最高的猛禽"(天然追分: 谁领先就压谁)\n' +
  '  if (frame % HARRIER_LOCK_FRAMES === 0 || !harrierTarget || raptors.indexOf(harrierTarget) < 0) {\n' +
  '    let best = null, bs = -Infinity;\n' +
  '    for (let i = 0; i < raptors.length; i++) { const r = raptors[i]; if (r.score > bs) { bs = r.score; best = r; } }\n' +
  '    if (best && best !== harrierTarget) {\n' +
  '      logDec(8, 255, "点名目标 -> " + best.label.split(" ")[0] + "(当前分 " + best.score.toFixed(1) + ") 共 " +\n' +
  '             harrierAliveCount() + " 只驱逐鸟");\n' +
  '    }\n' +
  '    harrierTarget = best;\n' +
  '  }\n' +
  '  // "刚得分"记账(贼鸥模式判据): 用 score 上涨检测, 比 dashEats 更贴"刚得分"\n' +
  '  for (let i = 0; i < raptors.length; i++) {\n' +
  '    const r = raptors[i];\n' +
  '    const prev = (r.hScorePrev === undefined) ? r.score : r.hScorePrev;\n' +
  '    if (r.score > prev) r.hGainT = frame;\n' +
  '    r.hScorePrev = r.score;\n' +
  '  }\n' +
  '  const T = harrierTarget;\n' +
  '\n' +
  '  // ② 压力: 目标 120px 内每帧 +1 层(上限 30)。规格口径 = "在带内每帧 +1 层", 与带内几只无关。\n' +
  '  if (T) {\n' +
  '    let inRange = 0;\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;\n' +
  '      const dx = minImageX(h.x - T.x), dy = minImageY(h.y - T.y);\n' +
  '      if (dx * dx + dy * dy <= HARRIER_RANGE2) inRange++;\n' +
  '    }\n' +
  '    T.hInRange = inRange;\n' +
  '    if (inRange > 0) hLayerSet(T, hLayerOf(T) + 1);\n' +
  '  }\n' +
  '\n' +
  '  // ③ 俯冲: 层满 30 且有"就绪(非恢复期)"的个体在带内 -> 最近的那只俯冲\n' +
  '  if (T && hLayerOf(T) >= HARRIER_LAYER_MAX) {\n' +
  '    let diver = null, dd = 1e18;\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0 || h.recover > 0) continue;\n' +
  '      const dx = minImageX(h.x - T.x), dy = minImageY(h.y - T.y);\n' +
  '      const d2 = dx * dx + dy * dy;\n' +
  '      if (d2 <= HARRIER_RANGE2 && d2 < dd) { dd = d2; diver = h; }\n' +
  '    }\n' +
  '    if (diver) {\n' +
  '      const skua = HARRIER_SKUA_ON && T.hGainT !== undefined && (frame - T.hGainT) <= HARRIER_SKUA_WINDOW;\n' +
  '      const frac = skua ? HARRIER_SKUA_BURN : HARRIER_DIVE_BURN;\n' +
  '      const burned = T.score * frac;              // 蒸发: 直接扣掉, 不进任何人的口袋\n' +
  '      T.score -= burned;\n' +
  '      if (T.kind === "eagle") T.pending -= burned;    // 鹰的 Q 学习要看见这次失分(与互攻扣分同规矩)\n' +
  '      T.stun += HARRIER_DIVE_STUN;\n' +
  '      stats.harrierDives++;\n' +
  '      stats.harrierScoreBurned += burned;\n' +
  '      if (skua) harrierSkuaHits++;\n' +
  '      diver.recover = HARRIER_RECOVER;\n' +
  '      diver.dives++;\n' +
  '      logDec(8, 200 + diver.slot, "俯冲 " + T.label.split(" ")[0] + ": stun+" + HARRIER_DIVE_STUN +\n' +
  '             " · 蒸发 " + burned.toFixed(1) + " 分(" + (frac * 100).toFixed(0) + "%" + (skua ? ", 贼鸥模式" : "") +\n' +
  '             ") -> 自身恢复 " + HARRIER_RECOVER + " 帧");\n' +
  '      hLayerSet(T, 0);                             // 压力释放: 层数清零, 下一轮重新堆\n' +
  '    }\n' +
  '  }\n' +
  '\n' +
  '  // ④ 逐只: 环绕点名目标 + 反制判定\n' +
  '  for (let i = 0; i < harriers.length; i++) {\n' +
  '    const h = harriers[i];\n' +
  '    if (h.dead > 0) { h.dead--; if (h.dead === 0) respawnHarrier(h); continue; }\n' +
  '    if (h.recover > 0) h.recover--;\n' +
  '    if (h.bumpCd > 0) h.bumpCd--;\n' +
  '\n' +
  '    let tx = h.memX, ty = h.memY, hasT = false;\n' +
  '    if (T) {                                       // 环绕点 = 点名目标 + 90px(< 压力半径, 一直咬住)\n' +
  '      h.orbitA += HARRIER_ORBIT_W;\n' +
  '      tx = wrapX(T.x + Math.cos(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '      ty = wrapY(T.y + Math.sin(h.orbitA) * HARRIER_ORBIT_R);\n' +
  '      hasT = true; h.memX = tx; h.memY = ty; h.memT = frame;\n' +
  '    } else if (freshMem(h)) hasT = true;\n' +
  '\n' +
  '    const dx = hasT ? minImageX(tx - h.x) : 0, dy = hasT ? minImageY(ty - h.y) : 0;\n' +
  '    const d = Math.hypot(dx, dy);\n' +
  '    const spd = HARRIER_SPEED * (h.recover > 0 ? HARRIER_RECOVER_SPEED : 1);\n' +
  '    const curA = Math.atan2(h.vy, h.vx);\n' +
  '    const wantA = (hasT && d > 1) ? Math.atan2(dy, dx) : curA;\n' +
  '    const fA = curA + clamp(angDiff(wantA, curA), -HARRIER_MAX_TURN, HARRIER_MAX_TURN);\n' +
  '    h.vx = Math.cos(fA) * spd; h.vy = Math.sin(fA) * spd;\n' +
  '    h.x = wrapX(h.x + h.vx); h.y = wrapY(h.y + h.vy);\n' +
  '\n' +
  '    // 反制: 猛禽冲刺中撞到 -> 驱逐鸟死亡(不给分); 非冲刺撞上 -> 双方弹开(不眩晕/不扣分)\n' +
  '    for (let k = 0; k < raptors.length; k++) {\n' +
  '      const r = raptors[k];\n' +
  '      const bx = minImageX(h.x - r.x), by = minImageY(h.y - r.y);\n' +
  '      const b2 = bx * bx + by * by;\n' +
  '      if (b2 > HARRIER_HIT_R2 || b2 < 1e-6) continue;\n' +
  '      const bd = Math.sqrt(b2), ux = bx / bd, uy = by / bd;      // r -> h 的单位向量\n' +
  '      if (r.dashT > 0) {\n' +
  '        stats.harrierDowns++;\n' +
  '        logDec(8, 200 + h.slot, "被 " + r.label.split(" ")[0] + " 冲刺撞落(不给分) -> " +\n' +
  '               HARRIER_RESPAWN_FRAMES + " 帧后重生");\n' +
  '        h.dead = HARRIER_RESPAWN_FRAMES; h.vx = 0; h.vy = 0;\n' +
  '        break;\n' +
  '      }\n' +
  '      if (h.bumpCd === 0) {                      // 非冲刺: 双方弹开(位置 + 速度), 不眩晕不扣分\n' +
  '        h.x = wrapX(h.x + ux * HARRIER_KNOCK); h.y = wrapY(h.y + uy * HARRIER_KNOCK);\n' +
  '        h.vx = ux * 4; h.vy = uy * 4;\n' +
  '        r.x = wrapX(r.x - ux * HARRIER_KNOCK * 0.5); r.y = wrapY(r.y - uy * HARRIER_KNOCK * 0.5);\n' +
  '        r.vx = -ux * 4; r.vy = -uy * 4;\n' +
  '        h.bumpCd = HARRIER_BUMP_CD;\n' +
  '        stats.harrierBumps++;\n' +
  '      }\n' +
  '    }\n' +
  '  }\n' +
  '}\n' +
  '\n' +
  'let eagle = eagles[0] || null;                 // 【第 8 轮修正】原为 const 别名: 鹰减到 0 再补一只后,'
);

/* ---------------- 3. resetPredators 里重置驱逐鸟 ---------------- */
must(
  '    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;\n' +
  '    E.z = Z_INIT; E.vz = 0; E.targetZ = -1;                           // 第 8 轮\n' +
  '  }\n' +
  '}',
  '    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;\n' +
  '    E.z = Z_INIT; E.vz = 0; E.targetZ = -1;                           // 第 8 轮\n' +
  '  }\n' +
  '  resetHarriers();                           // W8: 驱逐鸟随"重置猛禽"回到出生编制(压力层清零)\n' +
  '}'
);

/* ---------------- 4. stats 计数 ---------------- */
must(
  '                ghunterBanditReward: 0 };        // episode 奖励累计(兑现的分数口径: 雁+100/鸟+1/落空-4)',
  '                ghunterBanditReward: 0,         // episode 奖励累计(兑现的分数口径: 雁+100/鸟+1/落空-4)\n' +
  '                // ---- W8 驱逐鸟(harrier) ----\n' +
  '                harrierDives: 0,                 // 俯冲成功次数(验收: ≥3/4000 帧)\n' +
  '                harrierScoreBurned: 0,           // 被蒸发掉的总分(不进任何人口袋; 面板展示)\n' +
  '                harrierDowns: 0,                 // 被猛禽冲刺撞落的次数(不给分)\n' +
  '                harrierBumps: 0 };               // 非冲刺相撞弹开次数'
);

/* ---------------- 5. 决策日志类别 ---------------- */
must(
  'const DEC_KIND = ["鹰决策", "发起冲刺", "冲刺落空", "空冲刺罚款", "互攻", "ES采纳", "编制", "雁隼攻击"];',
  'const DEC_KIND = ["鹰决策", "发起冲刺", "冲刺落空", "空冲刺罚款", "互攻", "ES采纳", "编制", "雁隼攻击", "驱逐鸟"];   // W8: 末位新增'
);

/* ---------------- 6. stepRest: 6.0 驱逐鸟(排在 6.3 之前) ---------------- */
must(
  '  /* ---- 6.3 迁徙方向: 随机游动 + 离屏太远就掰回来 ---- */',
  '  /* ---- 6.0 W8 驱逐鸟: 点名 -> 压力堆叠 -> 俯冲 -> 反制 ----\n' +
  '   * 放在猛禽各段(6.6 鹰 / 6.8 隼 / 6.85 雁隼)之前: 压力层数必须先于它们的受力与能耗\n' +
  '   * 公式算好, 否则 debuff 慢一帧。它们不进 threats -> 不可食用、不触发鸟群逃逸。 */\n' +
  '  if (harrierOn) harrierStep();\n' +
  '\n' +
  '  /* ---- 6.3 迁徙方向: 随机游动 + 离屏太远就掰回来 ---- */'
);

/* ---------------- 7. 鹰: 巡航转向吃压力 ---------------- */
must(
  '    const slow = Math.max(MOB_SLOW_EAGLE, 1 - E.mob * 0.005) * (E.stun > 0 ? 0.65 : 1);',
  '    const hpk = hTurnPen(E);                   // W8: 驱逐鸟压力 -> 转向类参数倍率(1-0.02L)\n' +
  '    const slow = Math.max(MOB_SLOW_EAGLE, 1 - E.mob * 0.005) * (E.stun > 0 ? 0.65 : 1);'
);
must(
  '      if (hasT && dth > 1) { E.vx += dx / dth * 0.25; E.vy += dy / dth * 0.25; }',
  '      if (hasT && dth > 1) { E.vx += dx / dth * 0.25 * hpk; E.vy += dy / dth * 0.25 * hpk; }   // W8: 巡航制导 ×压力倍率'
);
must(
  '        const ca = Math.cos(0.05), sa = Math.sin(0.05);\n' +
  '        const nvx = E.vx * ca + E.vy * sa, nvy = -E.vx * sa + E.vy * ca;',
  '        const ca = Math.cos(0.05 * hpk), sa = Math.sin(0.05 * hpk);   // W8: 搜索盘旋 ×压力倍率\n' +
  '        const nvx = E.vx * ca + E.vy * sa, nvy = -E.vx * sa + E.vy * ca;'
);

/* ---------------- 8. 隼: 盘旋 / 制导 / 冲刺能耗吃压力 ---------------- */
must(
  '    const isActive = fi === activeId;\n' +
  '    if (f.stun > 0) f.stun--;                  // E: 眩晕每帧递减',
  '    const isActive = fi === activeId;\n' +
  '    const hpk = hTurnPen(f);                   // W8: 驱逐鸟压力 -> 转向类参数倍率(1-0.02L)\n' +
  '    if (f.stun > 0) f.stun--;                  // E: 眩晕每帧递减'
);
must(
  '      const drain = (DASH_DRAIN * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult;',
  '      const drain = (DASH_DRAIN * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult * hDrainPen(f);   // W8: 冲刺能耗 ×(1+0.03L)'
);
must(
  '          f.vx += DASH_HOME_K * (rx / rn * spd - f.vx);\n' +
  '          f.vy += DASH_HOME_K * (ry / rn * spd - f.vy);',
  '          f.vx += DASH_HOME_K * hpk * (rx / rn * spd - f.vx);   // W8: 冲刺末制导 ×压力倍率\n' +
  '          f.vy += DASH_HOME_K * hpk * (ry / rn * spd - f.vy);'
);
must(
  '      const ca = Math.cos(CIRCLE_TURN), sa = Math.sin(CIRCLE_TURN);\n' +
  '      const nvx = f.vx * ca + f.vy * sa;\n' +
  '      const nvy = -f.vx * sa + f.vy * ca;',
  '      const ca = Math.cos(CIRCLE_TURN * hpk), sa = Math.sin(CIRCLE_TURN * hpk);   // W8: 盘旋 ×压力倍率\n' +
  '      const nvx = f.vx * ca + f.vy * sa;\n' +
  '      const nvy = -f.vx * sa + f.vy * ca;'
);

/* ---------------- 9. 雁隼: 制导转艏 / 攻击能耗吃压力 ---------------- */
must(
  '    const who = ghunterWho(g);',
  '    const who = ghunterWho(g);\n' +
  '    const hpk = hTurnPen(g);                   // W8: 驱逐鸟压力 -> 转向类参数倍率(1-0.02L)'
);
must(
  '      const turnCap = g.stall > 0 ? GH_MAX_TURN * GH_STALL_TURN : GH_MAX_TURN;   // W5 失速段转艏受限',
  '      const turnCap = (g.stall > 0 ? GH_MAX_TURN * GH_STALL_TURN : GH_MAX_TURN) * hpk;   // W5 失速段转艏受限 / W8 压力'
);
must(
  '      const aNew = aCur + clamp(angDiff(aWant, aCur) + bias, -GH_STRIKE_TURN, GH_STRIKE_TURN);',
  '      const aNew = aCur + clamp(angDiff(aWant, aCur) + bias, -GH_STRIKE_TURN * hpk, GH_STRIKE_TURN * hpk);   // W8: 制导转艏 ×压力倍率'
);
must(
  '      g.energy = Math.max(0, g.energy - GH_DASH_DRAIN);',
  '      g.energy = Math.max(0, g.energy - GH_DASH_DRAIN * hDrainPen(g));   // W8: 攻击能耗 ×(1+0.03L)'
);

/* ---------------- 10. 面板: 计分板后加"驱逐鸟 战果"行 ---------------- */
must(
  '    </tr></tfoot>\n' +
  '  </table>\n' +
  '\n' +
  '  <div class="sec">生态</div>',
  '    </tr></tfoot>\n' +
  '  </table>\n' +
  '\n' +
  '  <div class="sec">驱逐鸟 战果（W8）</div>\n' +
  '  <div id="harrierLine" class="kv">—</div>\n' +
  '\n' +
  '  <div class="sec">生态</div>'
);

/* ---------------- 11. 开关 cbHarrier ---------------- */
must(
  '    <label class="chk"><input type="checkbox" id="cbEat3D">3D 吃判(捕食率约 1/4)</label>',
  '    <label class="chk"><input type="checkbox" id="cbEat3D">3D 吃判(捕食率约 1/4)</label>\n' +
  '    <label class="chk"><input type="checkbox" id="cbHarrier" checked>驱逐鸟(W8)</label>'
);
must(
  'el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 第 8 轮修正③: 吃判是否升 3D 球',
  'el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 第 8 轮修正③: 吃判是否升 3D 球\n' +
  'el("cbHarrier").onchange = e => { setHarrierOn(e.target.checked); };   // W8: 驱逐鸟开关(默认开; 关 = 验收对照口径)'
);

/* ---------------- 12. 面板刷新 + 清空计分 ---------------- */
must(
  '  el("corpseN").textContent = corpseCount();\n' +
  '  refreshRaidLine();                           // 第 7 轮: 增援编制与战果',
  '  el("corpseN").textContent = corpseCount();\n' +
  '  el("harrierLine").textContent = harrierLineText();   // W8: 驱逐鸟战果(俯冲次数/蒸发分/点名对象)\n' +
  '  refreshRaidLine();                           // 第 7 轮: 增援编制与战果'
);
must(
  '  stats.ghunterMiss = 0; stats.ghunterCooldownContacts = 0; stats.ghunterMaxDashSpeed = 0; stats.ghunterStallFrames = 0;',
  '  stats.ghunterMiss = 0; stats.ghunterCooldownContacts = 0; stats.ghunterMaxDashSpeed = 0; stats.ghunterStallFrames = 0;\n' +
  '  stats.harrierDives = 0; stats.harrierScoreBurned = 0; stats.harrierDowns = 0; stats.harrierBumps = 0;   // W8\n' +
  '  harrierSkuaHits = 0;'
);

/* ---------------- 13. 小地图: 驱逐鸟点 ---------------- */
must(
  '  for (const f of threats) {                   // 猛禽\n' +
  '    ctx.fillStyle = `rgb(${f.color})`;\n' +
  '    ctx.fillRect(mx(f.x) - 1.5, my(f.y) - 1.5, 3, 3);\n' +
  '  }',
  '  for (const f of threats) {                   // 猛禽\n' +
  '    ctx.fillStyle = `rgb(${f.color})`;\n' +
  '    ctx.fillRect(mx(f.x) - 1.5, my(f.y) - 1.5, 3, 3);\n' +
  '  }\n' +
  '  if (harrierOn) {                             // W8 驱逐鸟(青绿 2px 点)\n' +
  '    ctx.fillStyle = `rgb(${HARRIER_COLOR})`;\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;\n' +
  '      ctx.fillRect(mx(h.x) - 1, my(h.y) - 1, 2, 2);\n' +
  '    }\n' +
  '  }'
);

/* ---------------- 14. 2D 叠加层: 画驱逐鸟 + 压力环 ---------------- */
must(
  '    ctx.fillStyle = `rgb(${GH_COLOR})`;\n' +
  '    ctx.fillRect(bx, by, bw * g.energy / ENERGY_MAX, bh);\n' +
  '  }',
  '    ctx.fillStyle = `rgb(${GH_COLOR})`;\n' +
  '    ctx.fillRect(bx, by, bw * g.energy / ENERGY_MAX, bh);\n' +
  '  }\n' +
  '\n' +
  '  // ---- W8 驱逐鸟(harrier): 青绿小三角 + 点名者身边的压力环(不进食物网, 关掉时不画) ----\n' +
  '  if (harrierOn) {\n' +
  '    for (let i = 0; i < harriers.length; i++) {\n' +
  '      const h = harriers[i];\n' +
  '      if (h.dead > 0) continue;\n' +
  '      project(h.x, h.y, h.z, PR_A);\n' +
  '      if (!PR_A.ok) continue;\n' +
  '      const sp = Math.hypot(h.vx, h.vy) || 1;\n' +
  '      ctx.strokeStyle = `rgb(${HARRIER_COLOR})`;\n' +
  '      ctx.lineWidth = (h.recover > 0 ? 1.0 : 1.6) * Math.max(0.55, PR_A.s);\n' +
  '      ctx.shadowColor = `rgb(${HARRIER_COLOR})`;\n' +
  '      ctx.shadowBlur = h.recover > 0 ? 0 : 10;      // 恢复期不发光 = 猛禽的反杀窗口\n' +
  '      ctx.beginPath();\n' +
  '      drawArrow(PR_A.x, PR_A.y, h.vx / sp, h.vy / sp, 4.2 * PR_A.s, 2.6 * PR_A.s, 1.8 * PR_A.s);\n' +
  '      ctx.stroke();\n' +
  '      ctx.shadowBlur = 0;\n' +
  '    }\n' +
  '    const T = harrierTarget;\n' +
  '    if (T && hLayerOf(T) > 0) {                     // 压力环: 层数越满越亮(把 debuff 画出来)\n' +
  '      project(T.x, T.y, T.z, PR_A);\n' +
  '      if (PR_A.ok) {\n' +
  '        ctx.strokeStyle = `rgba(${HARRIER_COLOR}, ${0.10 + 0.35 * (hLayerOf(T) / HARRIER_LAYER_MAX)})`;\n' +
  '        ctx.lineWidth = 1.4 * Math.max(0.6, PR_A.s);\n' +
  '        ctx.beginPath();\n' +
  '        ctx.arc(PR_A.x, PR_A.y, HARRIER_RANGE * PR_A.s, 0, TAU);\n' +
  '        ctx.stroke();\n' +
  '      }\n' +
  '    }\n' +
  '  }'
);

/* ---------------- 15. SIM 钩子 ---------------- */
must(
  '  get ghunterCount() { return ghunters.length; },',
  '  get ghunterCount() { return ghunters.length; },\n' +
  '  // ---- W8 驱逐鸟(harrier): 验收/调试出口(存活数恒 0~HARRIER_N) ----\n' +
  '  get harrierCount() { return harrierAliveCount(); },          // 存活数(验收: 任意时刻 0~6)\n' +
  '  get harrierRoster() { return harriers.length; },             // 编制数(恒 HARRIER_N)\n' +
  '  get harrierOn() { return harrierOn; },\n' +
  '  setHarrier(v) { return setHarrierOn(v); },\n' +
  '  get harrierSkua() { return HARRIER_SKUA_ON; },\n' +
  '  setHarrierSkua(v) { HARRIER_SKUA_ON = !!v; return HARRIER_SKUA_ON; },\n' +
  '  get harrierPressure() { const T = harrierTarget; return T ? hLayerOf(T) : -1; },\n' +
  '  get harrierInfo() {\n' +
  '    const T = harrierTarget;\n' +
  '    return { on: harrierOn, roster: harriers.length, alive: harrierAliveCount(),\n' +
  '             targetIdx: T ? raptors.indexOf(T) : -1, targetLabel: T ? T.label : null,\n' +
  '             targetScore: T ? T.score : 0, targetLayer: T ? hLayerOf(T) : 0,\n' +
  '             dives: stats.harrierDives, burned: stats.harrierScoreBurned,\n' +
  '             downs: stats.harrierDowns, bumps: stats.harrierBumps, skuaHits: harrierSkuaHits,\n' +
  '             list: harriers.map(h => ({ id: h.slot, x: h.x, y: h.y, z: h.z, dead: h.dead,\n' +
  '                                        recover: h.recover, dives: h.dives })) };\n' +
  '  },\n' +
  '  get harrierConst() {\n' +
  '    return { n: HARRIER_N, speed: HARRIER_SPEED, color: HARRIER_COLOR, maxTurn: HARRIER_MAX_TURN,\n' +
  '             orbitR: HARRIER_ORBIT_R, orbitW: HARRIER_ORBIT_W, lockFrames: HARRIER_LOCK_FRAMES,\n' +
  '             range: HARRIER_RANGE, layerMax: HARRIER_LAYER_MAX, turnPen: HARRIER_TURN_PEN,\n' +
  '             drainPen: HARRIER_DRAIN_PEN, diveStun: HARRIER_DIVE_STUN, diveBurn: HARRIER_DIVE_BURN,\n' +
  '             skuaBurn: HARRIER_SKUA_BURN, skuaWindow: HARRIER_SKUA_WINDOW, recover: HARRIER_RECOVER,\n' +
  '             recoverSpeed: HARRIER_RECOVER_SPEED, respawnFrames: HARRIER_RESPAWN_FRAMES,\n' +
  '             respawnR: HARRIER_RESPAWN_R, hitR: HARRIER_HIT_R, knock: HARRIER_KNOCK,\n' +
  '             inThreats: threats.indexOf(harriers[0]) >= 0 };\n' +
  '  },'
);

/* ---------------- 16. handoffDoc 变更记录(W8) ---------------- */
must(
  '================================================================================\n' +
  '</script>\n' +
  '</body>\n' +
  '</html>',
  '================================================================================\n' +
  '\n' +
  '【变更记录(W8)】T3 驱逐鸟新物种 harrier(必胜鸟 / 贼鸥)\n' +
  '  · 生态位: **不可食用、不进 threats**、不触发鸟群逃逸、不参与互攻 —— 纯负外部性物种, 不进食物网。\n' +
  '    因此 6.4/6.5 的 EAT 判定天然不涉及它们(它们不在 threats 里), "所有 EAT 判定跳过 harrier" 由此成立。\n' +
  '  · 常量区(带动机注释): HARRIER_N=6 / HARRIER_SPEED=6.0 / HARRIER_COLOR="90,220,180" / HARRIER_LOCK_FRAMES=60 /\n' +
  '    HARRIER_RANGE=120 / HARRIER_LAYER_MAX=30 / HARRIER_TURN_PEN=0.02 / HARRIER_DRAIN_PEN=0.03 /\n' +
  '    HARRIER_DIVE_STUN=12 / HARRIER_DIVE_BURN=0.05 / HARRIER_SKUA_BURN=0.15 / HARRIER_SKUA_WINDOW=30 /\n' +
  '    HARRIER_RECOVER=20 / HARRIER_RECOVER_SPEED=0.6 / HARRIER_RESPAWN_FRAMES=60 / HARRIER_RESPAWN_R=300 /\n' +
  '    HARRIER_HIT_R=16 / HARRIER_KNOCK=11 / HARRIER_BUMP_CD=30 / HARRIER_ORBIT_R=90 / HARRIER_Z=150。\n' +
  '  · 点名: 每 60 帧选 score 最高的 raptor(追分机制)。压力: 目标 120px 内每帧 +1 层(上限 30)。\n' +
  '    debuff 接入点(逐条): 隼 6.8 盘旋 CIRCLE_TURN/冲刺末制导 DASH_HOME_K/冲刺能耗 drain;\n' +
  '    鹰 6.6 巡航制导 0.25 与搜索盘旋 0.05; 雁隼 6.85 制导转艏 GH_STRIKE_TURN 与巡航 turnCap/GH_DASH_DRAIN。\n' +
  '  · 俯冲: 层满 30 且有就绪个体在带内 -> 目标 stun+12、score 蒸发当前分 5%(贼鸥窗口内 15%),\n' +
  '    分不进任何人口袋; 俯冲者自身 20 帧 ×0.6 速(猛禽反杀窗口)。\n' +
  '  · 反制: 猛禽冲刺中撞到 -> 驱逐鸟阵亡(不给分), 60 帧后在椋鸟群质心外 300px 重生;\n' +
  '    非冲刺撞上 -> 双方弹开(复用互攻击退几何, 不眩晕不扣分)。\n' +
  '  · stats: harrierDives / harrierScoreBurned / harrierDowns / harrierBumps。\n' +
  '  · SIM: harrierCount(存活数) / harrierRoster / harrierInfo / harrierConst / harrierPressure /\n' +
  '    harrierOn / setHarrier / harrierSkua / setHarrierSkua。\n' +
  '  · 面板: 计分板后"驱逐鸟 战果"行 + 小地图青绿点 + 2D 叠加层三角形与压力环 + 开关 cbHarrier(默认开)。\n' +
  '  · 随机数纪律: 出生/重生/环绕全用确定性角度(黄金角), 热路径不消耗 Math.random -> 与"关掉驱逐鸟"的\n' +
  '    对照组共用同一条随机数流, 是干净的配对 A/B。\n' +
  '================================================================================\n' +
  '</script>\n' +
  '</body>\n' +
  '</html>'
);

/* ---------------- 体检 + 应用 ---------------- */
let bad = 0;
reps.forEach(([a], i) => {
  const n = t.split(a).length - 1;
  if (n !== 1) bad++;
  console.log(`${n === 1 ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 (锚点 ${a.split(NL).length} 行) ${a.split(NL)[0].slice(0, 60)}`);
});
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式, 未写文件; 加 --apply 才写回)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("有锚点未命中/重复 —— 不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`T3/W8 驱逐鸟补丁已应用: ${reps.length} 处`);
