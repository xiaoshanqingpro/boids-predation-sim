/* ============================================================================
 * task-6 (W1b): 边界厌恶饱和 + 猛禽不越界(边界预测) + 出生点修正
 * ----------------------------------------------------------------------------
 * 三组改动, 全部走精确字符串替换(每处必须**恰好命中一次**, 否则整体不写回):
 *   A. 常量区: BOUND_FORCE 一组 + 新的饱和/削减/预测/兜底常量
 *   B. applyBoundary / boundAccel: 抽出 boundAversion 核心(饱和 + 二次 ramp + 削减比例),
 *      applyBoundary 加"冲刺边界预测提前收势", 数值兜底收紧到世界外 60px; boundAccel 返回
 *      [nx, ny, F, cut] 并改两个调用点(椋鸟力 / 雁积分)
 *   C. 冲刺边界预测(拒绝发起): tryDash(隼) 与鹰的冲刺触发各加一道 boundPredOut 门
 *   D. 出生点: flockCenter/spawnPoint 辅助 + makeFalcon/makeEagle 初值 + resetPredators
 *      + initGeese 领队 + REFILL_SIDES 全部改成"世界内的鸟群质心附近"
 *   E. SIM.hunter 暴露 kind/label(验收探针要按种类区分)
 * 用法: node _patches/w1b_boundary_v2.mjs [--apply]
 *       不给 --apply 只做锚点体检(不写文件)。
 * ========================================================================== */
import fs from "node:fs";
const P = "掠食竞赛.html";
const APPLY = process.argv.includes("--apply");
let t = fs.readFileSync(P, "utf8");
const NL = "\n";
const reps = [];
const add = (a, b) => reps.push([a, b]);
const must = (a, b) => add(a, b);

/* ============================ A. 常量区 ============================ */
must(
  'const BOUND_FORCE = 0.30;                // 开阔世界的柔性边界力',
  '/* ---- 【task-6 W1b】边界厌恶: 饱和 + 平滑 + "削朝外速度"为主 -------------------\n' +
  ' * 实测问题: 旧式 F = BOUND_FORCE·k·pen²·9 (猛禽 k=2, pen=1.10 时峰值 5.9 px/帧², 而椋鸟\n' +
  ' * MAX_FORCE 只有 0.15) —— 个体在边界附近被"弹开", 观感是软墙, 不是自主转向。\n' +
  ' * 现在: ① 力饱和到 ≤ BOUND_F_MAX(px/帧²), 二次 ramp 平滑趋近上限;\n' +
  ' *       ② 主手段改成"削掉朝外速度分量": 比例从 BOUND_CUT_LO 升到 1.0(贴边时朝外分量\n' +
  ' *          被完全削掉 -> 沿边切向滑走), 力只负责柔和转向;\n' +
  ' *       ③ 冲刺期速度锁定, 削速度也改不了航向 -> 用边界预测(boundPredOut)在发起前否掉、\n' +
  ' *          在冲刺中提前收势;\n' +
  ' *       ④ 数值兜底收紧到"世界外 BOUND_FALLBACK", 触发即计入 boundClamp 供验收。 */\n' +
  'const BOUND_FORCE = 0.30;                // 边界厌恶力系数(pen² 的系数, 未饱和)\n' +
  'const BOUND_F_MAX = 0.60;                // 厌恶力饱和上限(px/帧²) —— 硬上限, 防"软墙"\n' +
  'const BOUND_CUT_LO = 0.35;               // 朝外速度削减比例下限(pen→0); pen→1 时升到 1.0\n' +
  'const DASH_BOUND_LOOK = 45;              // 冲刺边界预测帧数上限\n' +
  'const DASH_BOUND_MARGIN = 40;            // 预测预警余量(px): 预测点进入这个带内即视为会出界\n' +
  'const BOUND_FALLBACK = 60;               // 数值兜底: 真的跑到世界外这么多才硬夹(触发即计数)'
);

/* ==================== B. 边界核心 / applyBoundary / boundAccel ==================== */
must(
  '/* 【第 8 轮修正⑥】边界 = 厌恶值(不是墙):\n' +
  ' *   ① 进入 BOUND_R 带内 -> 加一个指向世界内部的力, 大小随 (1-d/R)² 增长(越近越强);\n' +
  ' *   ② 同时削掉"朝外"的速度分量, 免得带着惯性冲出去(只削朝外那部分, 不碰横向);\n' +
  ' *   ③ 正在冲刺(dashT>0)的猛禽速度是锁定的, 靠 ① 转不动 -> 进入带内较深处就主动收势(dashT=0);\n' +
  ' *   ④ 极远处的数值兜底(正常永不触发, 触发即计入 boundClamp 供验收检查)。\n' +
  ' * 这样所有个体都是"自己转开", 不会出现贴边/撞边。 */\n' +
  'let boundClamp = 0, boundPeak = 0, boundMinEdge = Infinity;\n' +
  'function applyBoundary(o, k) {\n' +
  '  if (TORUS) return;\n' +
  '  const dl = o.x, dr = W - o.x, dt = o.y, db = H - o.y;\n' +
  '  let nX = 0, nY = 0, pen = 0;\n' +
  '  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }\n' +
  '  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }\n' +
  '  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }\n' +
  '  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }\n' +
  '  const e = Math.min(dl, dr, dt, db);\n' +
  '  if (e < boundMinEdge) boundMinEdge = e;\n' +
  '  if (pen > 0) {\n' +
  '    if (pen > boundPeak) boundPeak = pen;\n' +
  '    const m = Math.hypot(nX, nY) || 1; nX /= m; nY /= m;\n' +
  '    const F = BOUND_FORCE * k * pen * pen * 9;\n' +
  '    o.vx += nX * F; o.vy += nY * F;\n' +
  '    const vOut = o.vx * nX + o.vy * nY;\n' +
  '    if (vOut < 0) { const cut = -vOut * 0.35 * pen; o.vx += nX * cut; o.vy += nY * cut; }\n' +
  '    if (o.dashT > 0 && pen > 0.5) o.dashT = 0;      // 冲刺中不硬转, 直接收势\n' +
  '  }\n' +
  '  // 数值兜底: 只有真的跑到世界外 2×BOUND_R 才动手(正常永不发生)\n' +
  '  if (o.x < -BOUND_R * 2 || o.x > W + BOUND_R * 2 || o.y < -BOUND_R * 2 || o.y > H + BOUND_R * 2) {\n' +
  '    o.x = clamp(o.x, -BOUND_R * 2, W + BOUND_R * 2); o.y = clamp(o.y, -BOUND_R * 2, H + BOUND_R * 2);\n' +
  '    boundClamp++;\n' +
  '  }\n' +
  '}\n' +
  '// 同上, 但直接在"数组结构(AoS 的 SoA 版)"上作用: 椋鸟/雁用力累加\n' +
  'function boundAccel(x, y, vx, vy, dashT) {\n' +
  '  if (TORUS) return null;\n' +
  '  const dl = x, dr = W - x, dt = y, db = H - y;\n' +
  '  let nX = 0, nY = 0, pen = 0;\n' +
  '  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }\n' +
  '  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }\n' +
  '  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }\n' +
  '  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }\n' +
  '  const e = Math.min(dl, dr, dt, db);\n' +
  '  if (e < boundMinEdge) boundMinEdge = e;\n' +
  '  if (pen <= 0) return null;\n' +
  '  if (pen > boundPeak) boundPeak = pen;\n' +
  '  const m = Math.hypot(nX, nY) || 1;\n' +
  '  return [nX / m, nY / m, pen];\n' +
  '}',

  '/* 【第 8 轮修正⑥ + task-6 W1b】边界 = 厌恶值(不是墙), 三件事拆开做:\n' +
  ' *   ① boundAversion(): 内向单位法线 n + 侵入度 pen(1 - 最近边距/BOUND_R, 世界外时 >1) +\n' +
  ' *      **饱和**后的力 F ≤ BOUND_F_MAX·k(二次 ramp: BOUND_FORCE·k·pen², 到顶就平) +\n' +
  ' *      "朝外速度削减比例" cut ∈ [BOUND_CUT_LO, 1](削速度是主手段, 力只管柔和转向);\n' +
  ' *   ② applyBoundary(o,k): 对象版(猛禽) —— 先削朝外分量、再加力, 然后做**冲刺边界预测**\n' +
  ' *      (冲刺期速度锁定, 力/削减都改不了航向: 预测会出界就把 dashT 收到 1, 下一帧走正常\n' +
  ' *       的"冲刺结束"流程, 不破坏落空罚款/锁定解除等既有账目);\n' +
  ' *   ③ boundAccel(): 数组版(椋鸟/雁) —— 返回 [nx, ny, F, cut], 调用方自己作用。\n' +
  ' * 数值兜底收紧到"世界外 BOUND_FALLBACK(60px)", 触发即计入 boundClamp; 出生点已保证在\n' +
  ' * 世界内, 正常永不触发。所有个体都是"自己转开", 不会贴边/撞边。 */\n' +
  'let boundClamp = 0, boundPeak = 0, boundMinEdge = Infinity;\n' +
  '\n' +
  '// 边界厌恶核心: 返回 [nx, ny, F, cut]; null = 不在厌恶带内。k = 力倍率(椋鸟/雁 1, 猛禽 2)\n' +
  'function boundAversion(x, y, k) {\n' +
  '  if (TORUS) return null;\n' +
  '  const dl = x, dr = W - x, dt = y, db = H - y;\n' +
  '  let nX = 0, nY = 0, pen = 0;\n' +
  '  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }\n' +
  '  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }\n' +
  '  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }\n' +
  '  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }\n' +
  '  const e = Math.min(dl, dr, dt, db);\n' +
  '  if (e < boundMinEdge) boundMinEdge = e;\n' +
  '  if (pen <= 0) return null;\n' +
  '  if (pen > boundPeak) boundPeak = pen;\n' +
  '  const m = Math.hypot(nX, nY) || 1;\n' +
  '  const p = Math.min(pen, 1);                                     // pen>1(世界外)时不再加码\n' +
  '  const F = Math.min(BOUND_F_MAX * k, BOUND_FORCE * k * p * p);   // 二次 ramp + 饱和\n' +
  '  return [nX / m, nY / m, F, BOUND_CUT_LO + (1 - BOUND_CUT_LO) * p];\n' +
  '}\n' +
  '\n' +
  '/* 【task-6】边界预测: 按 (vx,vy) 直行 look 帧后是否冲进"世界内 LR 余量"的带内/带外。\n' +
  ' * 冲刺速度每帧被重设(锁定), 力与削速度都改不了航向 -> 必须在发起前否掉, 或冲刺中提前收势。 */\n' +
  'function boundPredOut(x, y, vx, vy, look, LR) {\n' +
  '  if (TORUS || !(look > 0)) return false;\n' +
  '  const x1 = x + vx * look, y1 = y + vy * look;\n' +
  '  return x1 < LR || x1 > W - LR || y1 < LR || y1 > H - LR;\n' +
  '}\n' +
  '\n' +
  'function applyBoundary(o, k) {\n' +
  '  if (TORUS) return;\n' +
  '  const av = boundAversion(o.x, o.y, k);\n' +
  '  if (av) {\n' +
  '    const nX = av[0], nY = av[1];\n' +
  '    const vOut = o.vx * nX + o.vy * nY;             // <0 = 正在朝外飞\n' +
  '    if (vOut < 0) { const cut = -vOut * av[3]; o.vx += nX * cut; o.vy += nY * cut; }\n' +
  '    o.vx += nX * av[2]; o.vy += nY * av[2];         // 削减为主, 力只补柔和转向\n' +
  '  }\n' +
  '  if (o.dashT > 0) {                                // 冲刺边界预测: 会出界 -> 提前收势\n' +
  '    const L = Math.min(o.dashT, DASH_BOUND_LOOK);\n' +
  '    if (boundPredOut(o.x, o.y, o.vx, o.vy, L, DASH_BOUND_MARGIN)) o.dashT = Math.min(o.dashT, 1);\n' +
  '  }\n' +
  '  // 数值兜底: 只有真的跑到世界外 BOUND_FALLBACK 才硬夹(出生点修好后正常永不发生)\n' +
  '  if (o.x < -BOUND_FALLBACK || o.x > W + BOUND_FALLBACK || o.y < -BOUND_FALLBACK || o.y > H + BOUND_FALLBACK) {\n' +
  '    o.x = clamp(o.x, -BOUND_FALLBACK, W + BOUND_FALLBACK);\n' +
  '    o.y = clamp(o.y, -BOUND_FALLBACK, H + BOUND_FALLBACK);\n' +
  '    boundClamp++;\n' +
  '  }\n' +
  '}\n' +
  '\n' +
  '// 数组版(椋鸟/雁): 返回 [nx, ny, F, cut], 调用方自己作用到加速度/速度上\n' +
  'function boundAccel(x, y, k) { return boundAversion(x, y, k || 1); }'
);

/* ---- B2. 椋鸟受力点: 用 [F, cut] ---- */
must(
  '    if (!tor) {                                // 【第 8 轮修正⑥】边界厌恶力(不是墙)\n' +
  '      const bd = boundAccel(xi, yi, V[vi], V[vi + 1], 0);\n' +
  '      if (bd) {\n' +
  '        const pen = bd[2];\n' +
  '        const F = BOUND_FORCE * pen * pen * 9;\n' +
  '        ax += bd[0] * F; ay += bd[1] * F;\n' +
  '        const vOut = V[vi] * bd[0] + V[vi + 1] * bd[1];\n' +
  '        if (vOut < 0) { const cut = -vOut * 0.35 * pen; ax += bd[0] * cut; ay += bd[1] * cut; }\n' +
  '      }\n' +
  '    }',
  '    if (!tor) {                                // 【第 8 轮修正⑥ / task-6】边界厌恶(不是墙)\n' +
  '      const bd = boundAccel(xi, yi);\n' +
  '      if (bd) {\n' +
  '        const vOut = V[vi] * bd[0] + V[vi + 1] * bd[1];\n' +
  '        if (vOut < 0) { const cut = -vOut * bd[3]; ax += bd[0] * cut; ay += bd[1] * cut; }\n' +
  '        ax += bd[0] * bd[2]; ay += bd[1] * bd[2];\n' +
  '      }\n' +
  '    }'
);

/* ---- B3. 雁积分点: 同样是 [F, cut] ---- */
must(
  '    if (!TORUS) {                              // 【第 8 轮修正⑥】雁也要"厌恶边界"\n' +
  '      const bd = boundAccel(xi, yi, V2[2*i], V2[2*i+1], 0);\n' +
  '      if (bd) {\n' +
  '        const pen = bd[2], F = BOUND_FORCE * pen * pen * 9;\n' +
  '        V2[2*i] += bd[0] * F; V2[2*i+1] += bd[1] * F;\n' +
  '      }\n' +
  '    }',
  '    if (!TORUS) {                              // 【第 8 轮修正⑥ / task-6】雁也要"厌恶边界"\n' +
  '      const bd = boundAccel(xi, yi);\n' +
  '      if (bd) {\n' +
  '        const vOut = V2[2*i] * bd[0] + V2[2*i+1] * bd[1];\n' +
  '        if (vOut < 0) { const cut = -vOut * bd[3]; V2[2*i] += bd[0] * cut; V2[2*i+1] += bd[1] * cut; }\n' +
  '        V2[2*i] += bd[0] * bd[2]; V2[2*i+1] += bd[1] * bd[2];\n' +
  '      }\n' +
  '    }'
);

/* ==================== C. 冲刺前边界预测(拒绝发起) ==================== */
must(
  '  f.vx = dx / n * DASH_SPEED;\n' +
  '  f.vy = dy / n * DASH_SPEED;\n' +
  '  f.vz = dz / n * DASH_SPEED;\n' +
  '  f.dashT = Math.floor((Math.min(n, DASH_MAX_DIST) + DASH_EXTRA) / DASH_SPEED);',
  '  const dashFrames = Math.floor((Math.min(n, DASH_MAX_DIST) + DASH_EXTRA) / DASH_SPEED);\n' +
  '  // 【task-6】边界预测: 冲刺期速度锁定 -> 按本次冲刺方向直行会冲出世界就不发起(此时还没改速度)\n' +
  '  if (boundPredOut(f.x, f.y, dx / n * DASH_SPEED, dy / n * DASH_SPEED, dashFrames, DASH_BOUND_MARGIN)) return false;\n' +
  '  f.vx = dx / n * DASH_SPEED;\n' +
  '  f.vy = dy / n * DASH_SPEED;\n' +
  '  f.vz = dz / n * DASH_SPEED;\n' +
  '  f.dashT = dashFrames;'
);
must(
  '      if (Math.abs(angDiff(tgtA, curA)) <= DASH_MAX_ANGLE) {\n' +
  '        E.dashT = EAGLE_DASH_FRAMES; E.cool = EAGLE_DASH_CD;',
  '      // 【task-6】边界预测: 冲刺期速度锁定 -> 预计会冲出世界就不发起这次冲刺\n' +
  '      if (Math.abs(angDiff(tgtA, curA)) <= DASH_MAX_ANGLE &&\n' +
  '          !boundPredOut(E.x, E.y, dx / dth * EAGLE_DASH, dy / dth * EAGLE_DASH, EAGLE_DASH_FRAMES, DASH_BOUND_MARGIN)) {\n' +
  '        E.dashT = EAGLE_DASH_FRAMES; E.cool = EAGLE_DASH_CD;'
);

/* ==================== D. 出生点 ==================== */
must(
  'const falcons = [\n' +
  '  makeFalcon("235,70,70",  "隼① FALCON",   W / 2, -40,   0,  CIRCLE_SPEED, 30),\n' +
  '  makeFalcon("70,150,255", "隼② FALCON-2", W / 2, H + 40, 0, -CIRCLE_SPEED, 200),\n' +
  '];',
  '/* 【task-6】出生点: 以"当前鸟群质心"为基准的极坐标方位, 并保证完全落在世界内。\n' +
  ' * W1 把世界与视口解耦(1280×720 -> 3200×2200)之后, 旧代码的 W/2、-40、H+40、W*0.7\n' +
  ' * 这些"旧世界边角"假设会让猛禽出生在离鸟群 ~1100px 的世界边缘(甚至世界外 35px):\n' +
  ' * 视野只有 420px 的隼根本找不到猎物, 生态被打断(实测总捕获 0)。\n' +
  ' * 现在: 质心 ±300px 的错开方位(隼①正上 / 隼②正下 / 鹰斜向 / 雁另一侧), 出生即在视野内。\n' +
  ' * 注意 flockCenter() 在模块求值期(椋鸟还没出生)会退化成世界中心, 开局由 resetPredators()\n' +
  ' * 用真实质心再摆一次位。 */\n' +
  'const SPAWN_MARGIN = 90;                       // 出生点离世界四边至少留这么多(> DASH_BOUND_MARGIN)\n' +
  'function flockCenter() {\n' +
  '  let sx = 0, sy = 0, c = 0;\n' +
  '  for (let i = 0; i < N; i++) if (alive[i]) { sx += P[2*i]; sy += P[2*i+1]; c++; }\n' +
  '  return c ? { x: sx / c, y: sy / c } : { x: W / 2, y: H / 2 };\n' +
  '}\n' +
  '// 质心为原点、方位角 ang、半径 r 的点(先夹到世界内, 环面模式再取模)\n' +
  'function spawnPoint(ang, r) {\n' +
  '  const c = flockCenter();\n' +
  '  return { x: wrapX(clamp(c.x + Math.cos(ang) * r, SPAWN_MARGIN, W - SPAWN_MARGIN)),\n' +
  '           y: wrapY(clamp(c.y + Math.sin(ang) * r, SPAWN_MARGIN, H - SPAWN_MARGIN)) };\n' +
  '}\n' +
  'const FALCON_HOME_A = -Math.PI / 2, FALCON_HOME_B = Math.PI / 2;   // 隼① 正上 / 隼② 正下\n' +
  'const EAGLE_HOME_A  = Math.PI * 0.28;                             // 鹰: 斜向, 与两只隼错开\n' +
  'const GOOSE_HOME_A  = Math.PI * 1.15;                             // 雁群: 另一侧, 免得开局就撞上猛禽\n' +
  'const RAPTOR_HOME_R = 300, GOOSE_HOME_R = 300;                    // 离质心的距离(隼视野 420px)\n' +
  'const F0_HOME = spawnPoint(FALCON_HOME_A, RAPTOR_HOME_R);\n' +
  'const F1_HOME = spawnPoint(FALCON_HOME_B, RAPTOR_HOME_R);\n' +
  'const falcons = [\n' +
  '  makeFalcon("235,70,70",  "隼① FALCON",   F0_HOME.x, F0_HOME.y, 0,  CIRCLE_SPEED, 30),\n' +
  '  makeFalcon("70,150,255", "隼② FALCON-2", F1_HOME.x, F1_HOME.y, 0, -CIRCLE_SPEED, 200),\n' +
  '];'
);
must(
  'const eagles = [makeEagle(W * 0.7, H * 0.7, "鹰 EAGLE")];',
  'const EAGLE_HOME = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);\n' +
  'const eagles = [makeEagle(EAGLE_HOME.x, EAGLE_HOME.y, "鹰 EAGLE")];'
);

/* ---- D2. resetPredators ---- */
must(
  '  while (falcons.length < 2) {\n' +
  '    const k = falcons.length;\n' +
  '    const nf = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],\n' +
  '      "隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),\n' +
  '      W / 2, inOpen ? (k ? H + 40 : -40) : H * (k ? 0.85 : 0.15),\n' +
  '      0, k ? -CIRCLE_SPEED : CIRCLE_SPEED, k ? 200 : 30);\n' +
  '    falcons.push(nf); raptors.push(nf);\n' +
  '  }\n' +
  '  while (eagles.length < 1) { const ne = makeEagle(W * 0.7, H * 0.7, "鹰① EAGLE"); eagles.push(ne); raptors.push(ne); }\n' +
  '  const f0 = falcons[0], f1 = falcons[1];\n' +
  '  f0.x = W / 2; f0.y = inOpen ? -40 : H * 0.15; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;\n' +
  '  f1.x = W / 2; f1.y = inOpen ? H + 40 : H * 0.85; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;',
  '  // 【task-6】出生点 = 鸟群质心附近 ±300px 的错开方位(必须在世界内, 且进隼的 420px 视野)\n' +
  '  const base = flockCenter();\n' +
  '  const home0 = spawnPoint(FALCON_HOME_A, RAPTOR_HOME_R);\n' +
  '  const home1 = spawnPoint(FALCON_HOME_B, RAPTOR_HOME_R);\n' +
  '  const homeE = spawnPoint(EAGLE_HOME_A, RAPTOR_HOME_R);\n' +
  '  while (falcons.length < 2) {\n' +
  '    const k = falcons.length;\n' +
  '    const hm = k ? home1 : home0;\n' +
  '    const nf = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],\n' +
  '      "隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),\n' +
  '      hm.x, hm.y, 0, k ? -CIRCLE_SPEED : CIRCLE_SPEED, k ? 200 : 30);\n' +
  '    falcons.push(nf); raptors.push(nf);\n' +
  '  }\n' +
  '  while (eagles.length < 1) { const ne = makeEagle(homeE.x, homeE.y, "鹰① EAGLE"); eagles.push(ne); raptors.push(ne); }\n' +
  '  const f0 = falcons[0], f1 = falcons[1];\n' +
  '  f0.x = home0.x; f0.y = home0.y; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;\n' +
  '  f1.x = home1.x; f1.y = home1.y; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;'
);
must(
  '    f.memX = W / 2; f.memY = H / 2; f.memT = -1e9; f.seeing = false;',
  '    f.memX = base.x; f.memY = base.y; f.memT = -1e9; f.seeing = false;   // 【task-6】记忆点=鸟群质心'
);
must(
  '    E.x = W * 0.7; E.y = H * 0.7; E.vx = 0; E.vy = 0;',
  '    E.x = homeE.x; E.y = homeE.y; E.vx = 0; E.vy = 0;   // 【task-6】世界内的鸟群质心附近'
);
must(
  '    E.memX = W * 0.5; E.memY = H * 0.5; E.memT = -1e9; E.seeing = false;',
  '    E.memX = base.x; E.memY = base.y; E.memT = -1e9; E.seeing = false;   // 【task-6】记忆点=鸟群质心'
);

/* ---- D3. 雁群领队出生点 ---- */
must(
  '  Lx = wrapX(W * 0.3); Ly = wrapY(H * 0.3);',
  '  // 【task-6】雁群领队出生点: 也放到鸟群质心附近(旧值 W*0.3/H*0.3 离质心 780px, 在\n' +
  '  // 3200×2200 的世界里是偏僻角落, 雁群与椋鸟群会长期分离)\n' +
  '  const gHome = spawnPoint(GOOSE_HOME_A, GOOSE_HOME_R);\n' +
  '  Lx = gHome.x; Ly = gHome.y;'
);

/* ---- D4. 补充点必须落在世界内 ---- */
must(
  'const REFILL_SIDES = [\n' +
  '  { x: -PAD - 20, y: H / 2, inx: 1, iny: 0 },\n' +
  '  { x: W + PAD + 20, y: H / 2, inx: -1, iny: 0 },\n' +
  '  { x: W / 2, y: -PAD - 20, inx: 0, iny: 1 },\n' +
  '  { x: W / 2, y: H + PAD + 20, inx: 0, iny: -1 },\n' +
  '];',
  '// 【task-6】补充点必须落在**世界内**: 旧式 -PAD-20 / W+PAD+20 是"视口±缓冲带"时代的边角\n' +
  '// (世界 1280×720 时它们刚好在世界外一点, 是有意的"从外面补进来"); 世界解耦到 3200×2200\n' +
  '// 后, 这四点仍在 (0,0) 附近算, 全部落在世界外 190px —— 补进来的鸟一出生就越界。\n' +
  'const FILL_INSET = 120;                  // 补充点离世界边的距离(> 个体一帧最大位移)\n' +
  'const REFILL_SIDES = [\n' +
  '  { x: FILL_INSET, y: H / 2, inx: 1, iny: 0 },\n' +
  '  { x: W - FILL_INSET, y: H / 2, inx: -1, iny: 0 },\n' +
  '  { x: W / 2, y: FILL_INSET, inx: 0, iny: 1 },\n' +
  '  { x: W / 2, y: H - FILL_INSET, inx: 0, iny: -1 },\n' +
  '];'
);

/* ==================== E. SIM.hunter 暴露 kind/label ==================== */
must(
  '    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,\n' +
  '             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,\n' +
  '             score: h.score, dashEats: h.dashEats || 0 };',
  '    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,\n' +
  '             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,\n' +
  '             score: h.score, dashEats: h.dashEats || 0,\n' +
  '             kind: h.kind || "raptor", label: h.label || "" };   // 【task-6】验收探针要按种类区分'
);

/* ============================ 体检 + 应用 ============================ */
let bad = 0;
const NLc = a => a.split(NL).length;
reps.forEach(([a, b], i) => {
  const n = t.split(a).length - 1;
  const okOne = n === 1;
  if (!okOne) bad++;
  console.log(`${okOne ? "✓" : "✗"} #${i + 1} 命中 ${n} 次 (锚点 ${NLc(a)} 行) ${a.split(NL)[0].slice(0, 62)}`);
});
console.log(`锚点 ${reps.length} 处, 异常 ${bad} 处`);
if (!APPLY) { console.log("(体检模式, 未写文件; 加 --apply 才写回)"); process.exit(bad ? 1 : 0); }
if (bad) { console.log("有锚点未命中/重复 —— 不写回"); process.exit(1); }
for (const [a, b] of reps) t = t.split(a).join(b);
fs.writeFileSync(P, t);
console.log(`task-6 补丁已应用: ${reps.length} 处`);
