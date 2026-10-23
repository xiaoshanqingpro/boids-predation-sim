/* T1b(W6b) 隼·配合四件套: 主文件补丁 (文件形式, 避免 node -e 拼中文引号)
 * 用法: node _w6w9/t1b_patch.mjs            # 干跑, 只报告 anchor 命中
 *       node _w6w9/t1b_patch.mjs --apply   # 真正写回 掠食竞赛(4).html
 * 幂等: 已打过的锚点(from 不再出现 且 to 已存在)会被跳过并报告; 任一锚点歧义/未命中则不写回。
 * 基线: 掠食竞赛(4).html sha256 471ACC034356D0864F23320FA8BB20DDDF8D8A2AAF88CFF3265223D0951CC4F1
 * 对应施工文档 §T1b 五条: ①拦截位升级(p7) ②牧羊位 ③共享感知 ④事件双打 ⑤同盟豁免。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = process.env.T1B_TARGET
  ? path.resolve(ROOT, process.env.T1B_TARGET)
  : path.join(ROOT, "掠食竞赛(4).html");

const E = [];

/* ================= ① 常量区: W6b 四件套常量 ================= */
E.push([`const F_FEAST_RECOVER = 60;              // W6: 吃到雁后额外盘旋帧数(大餐收尾)`,
`const F_FEAST_RECOVER = 60;              // W6: 吃到雁后额外盘旋帧数(大餐收尾)
/* ---- W6b(T1b): 隼·配合四件套常量 ------------------------------------------
 * ① 拦截位升级(前置追踪解): 设伏方拦截位 = 质心 + 群体均速 × min(F_INTERCEPT_MAX,
 *    追猎方到质心距离/DASH_SPEED + 设伏方到质心距离/REST_SPEED) × p7。
 *    p7 = P_LEAD_TIME = 前置时间倍率 [0.5, 2.0] 默认 1.0(ES 新参数, ES_NP 6→7);
 *    旧的 PV_.interceptAhead(p4) 与 INTERCEPT_AHEAD 常量**不再被任何决策读取**,
 *    参数位保留并标 deprecated(见常量区与交接文档)。
 *    min(120) 的理由: 鸟群 3.6px/帧、隼视野 420px, 120 帧 ≈ 一刻钟的提前量,
 *    再往前推的拦截点已在视野之外且会被下一步的重新采样覆盖 —— 实测提前量 >120 帧
 *    后设伏方只是"绕远路", 到达时鸟群早已改向。
 * ② 牧羊位 F_SHEPHERD_R=180: 追猎方的巡航目标 = 质心与设伏方连线的延长线上、质心外侧
 *    180px。追猎方站到羊群远离设伏方的一侧, 鸟群被它赶向设伏方 —— 只改巡航走位,
 *    冲刺决策仍走捞勺采样(施工单原文)。
 * ③ 共享感知 F_SHARE_R=150: 设伏方自己 perceive 为 null 或目标 >150px 时, 改用追猎方
 *    **上一帧**的 pc(按值拷贝 cx/cy/lockIdx/score/n/mvx/mvy + 走位要用的 x/y/z/lockZ);
 *    150px 内仍用自己的(近距离自己更新鲜)。
 * ④ 事件双打: 任一隼 tryDash 成功当帧 -> 其余隼若 energy ≥ 各自 dashMin 则 circleT=0,
 *    且其**下一次**冲刺的捞勺打分对"那次冲刺方向的反方向 ±60° 扇区"候选点 ×F_EVT_BIAS。
 *    原能量双打(p3/DOUBLE_TEAM_E)逻辑删除, 参数位保留并标 deprecated。
 * ⑤ 同盟豁免: 驱逐冲刺跳过同 kind; 6.10 互攻里 falcon-falcon 保留击退+眩晕+CLASH_CD,
 *    废除 CLASH_COST 扣分与 STEAL_FRAC 抢分(只对 鹰/雁隼 生效)。 */
const F_SHEPHERD_R = 180;                // W6b②: 牧羊位半径(质心外侧, px)
const F_SHARE_R = 150;                   // W6b③: 共享感知的启用距离门限(px)
const F_EVT_BIAS = 1.5;                  // W6b④: 事件双打的候选点偏向倍率
const F_EVT_SECTOR = Math.PI / 3;        // W6b④: 偏向扇区半角 60°
const F_EVT_COS = Math.cos(F_EVT_SECTOR);
const F_INTERCEPT_MAX = 120;             // W6b①: 前置时间上限(帧)`]);

/* ================= ① ES: p7 + ES_NP 6->7 + p3/p4 deprecated ================= */
E.push([`const P_DOUBLE_TEAM = [60, 95, 85];              // p3 双打能量阈值
const P_INTERCEPT = [0.3, 0.8, 0.55];            // p4 拦截位外推比例`,
`const P_DOUBLE_TEAM = [60, 95, 85];              // p3 【W6b deprecated】原"能量双打"阈值: 逻辑已被事件双打取代, 参数位保留(ES 向量索引不变)但不再被读取
const P_INTERCEPT = [0.3, 0.8, 0.55];            // p4 【W6b deprecated】原"拦截位外推比例": 已被 p7(前置时间倍率)取代, 参数位保留但不再被读取`]);

E.push([`const P_CHAIN_R = [F_CHAIN_R * 0.5, F_CHAIN_R * 1.5, F_CHAIN_R * 1.0];   // p6 [下界, 上界, 默认] = [30, 90, 60]px
const ES_NP = 6;                                 // 可学习参数个数(p6 = 链式再锁定半径倍率)`,
`const P_CHAIN_R = [F_CHAIN_R * 0.5, F_CHAIN_R * 1.5, F_CHAIN_R * 1.0];   // p6 [下界, 上界, 默认] = [30, 90, 60]px
/* W6b(T1b): p7 = 前置时间倍率(拦截位提前量), 映射到 [0.5, 2.0] 帧倍率, 默认 1.0。
 * 它是"设伏方提前多少去堵"的操作参数(制度内的量), 与 p1~p6 同类 -> 交给 (1+1)-ES 学。
 * 取代了原 p4/P_INTERCEPT(拦截位外推比例): 旧解只用"追猎方->猎物"的一阶方向, 新解用
 * 群体均速 × 双方距离导出的时间量, 量纲从"比例"变成"帧", 才能被 p7 直接缩放。 */
const P_LEAD_TIME = [0.5, 2.0, 1.0];             // p7 [下界, 上界, 默认]
const ES_NP = 7;                                 // 可学习参数个数(p6 = 再锁定半径, p7 = 前置时间倍率)`]);

E.push([`    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL), norm(P_CHAIN_R)]),   // 当前生效参数(W6: +p6)`,
`    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL), norm(P_CHAIN_R),
                         norm(P_LEAD_TIME)]),   // 当前生效参数(W6: +p6; W6b: +p7)`]);

E.push([`const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0, chainR: 0, chainR2: 0 };`,
`const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0, chainR: 0, chainR2: 0, leadK: 0 };`]);

E.push([`  PVV.chainR = denorm(P_CHAIN_R, p[5]);                  // W6: 再锁定半径 ∈[30,90]px(默认 60 = F_CHAIN_R)
  PVV.chainR2 = PVV.chainR * PVV.chainR;
  return PVV;`,
`  PVV.chainR = denorm(P_CHAIN_R, p[5]);                  // W6: 再锁定半径 ∈[30,90]px(默认 60 = F_CHAIN_R)
  PVV.chainR2 = PVV.chainR * PVV.chainR;
  PVV.leadK = denorm(P_LEAD_TIME, p[6]);                 // W6b: 前置时间倍率 ∈[0.5,2.0](默认 1.0)
  return PVV;`]);

E.push([`const DOUBLE_TEAM_E = 85;                // 设伏方能量高于此且距密集点近 -> 偶发双打`,
`const DOUBLE_TEAM_E = 85;                // 【W6b deprecated】原"能量双打"阈值: 逻辑已被事件双打取代, 保留仅供历史对照, 不被读取`]);

E.push([`const INTERCEPT_AHEAD = 0.55;            // 拦截位 = 质心沿"远离追猎方"方向外推的比例`,
`const INTERCEPT_AHEAD = 0.55;            // 【W6b deprecated】原拦截位外推比例: 已被 p7(P_LEAD_TIME 前置时间倍率)取代, 不被读取`]);

/* ================= ② 帧间状态 + makeFalcon 新字段 ================= */
E.push([`let activeId = 0;                          // 当前追猎方; 其他人设伏 + 恢复`,
`let activeId = 0;                          // 当前追猎方; 其他人设伏 + 恢复
let ambushId = -1;                         // W6b②: 本帧设伏方(非追猎方里离质心最近者); -1 = 无(单隼)
let evtDashDir = null, evtDashBy = -1;     // W6b④: 本帧冲刺事件(方向/发起者下标), 由 tryDash 写入`]);

E.push([`           chainFrames: 0,                                // W6: 换目标首帧的一次性全量转向剩余帧
           mob: 0, stun: 0, clashCd: 0,`,
`           chainFrames: 0,                                // W6: 换目标首帧的一次性全量转向剩余帧
           /* W6b(T1b) 四件套的每隼状态: lastPC = 本帧有效 pc 的**按值拷贝**(自己感知的结果;
            * 被共享覆盖时也写在这里 —— 绝不存 PC/SHARED_PC 的引用); sharedUses = 用过共享的帧数;
            * biasDir = 下一次冲刺的偏向角(事件双打发牌, 用过即清); evtDouble = 事件双打待出手标记。 */
           lastPC: makePC(), sharedUses: 0, biasDir: null, evtDouble: 0,
           mob: 0, stun: 0, clashCd: 0,`]);

/* ================= ③ perceive: PC + mvx/mvy + biasDir ================= */
E.push([`const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, z: Z_INIT };`,
`const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, z: Z_INIT, mvx: 0, mvy: 0 };   // W6b①: +群体均速
/* W6b③: 共享感知的**按值拷贝**载体。PC 是每帧复用的全局对象(3 个调用者共用),
 * 所以"把追猎方的 pc 借给设伏方"必须拷贝到这组字段上, 不许把引用传出去。 */
function makePC() { return { cx: -1, cy: -1, lockIdx: -1, score: 0, n: 0, mvx: 0, mvy: 0, x: 0, y: 0, z: Z_INIT, lockZ: Z_INIT, frame: -1e9 }; }
function copyPC(dst, src) {
  dst.cx = src.cx; dst.cy = src.cy; dst.lockIdx = src.lockIdx; dst.score = src.score; dst.n = src.n;
  dst.mvx = src.mvx; dst.mvy = src.mvy; dst.x = src.x; dst.y = src.y; dst.z = src.z; dst.lockZ = src.lockZ;
  if (src.frame !== undefined) dst.frame = src.frame;
  return dst;
}
const SHARED_PC = makePC();       // 追猎方**上一帧**的 pc 快照(frame 戳严格比对)
const SHEP = { x: 0, y: 0 };      // W6b②: 牧羊位复用坐标(零分配)`]);

E.push([`function perceive(px, py, vx, vy, viewR2) {`,
`function perceive(px, py, vx, vy, viewR2, biasDir) {   // W6b④: biasDir = 事件双打的偏向扇区中心(默认 undefined/null = 不启用)`]);

E.push([`  let cnt = 0, nVis = 0;
  let sumX = 0, sumY = 0, sumZ = 0, scx = 0, ssx = 0, scy = 0, ssy = 0;   // 第 8 轮: sumZ`,
`  let cnt = 0, nVis = 0;
  let sumX = 0, sumY = 0, sumZ = 0, scx = 0, ssx = 0, scy = 0, ssy = 0;   // 第 8 轮: sumZ
  let sumVX = 0, sumVY = 0;                                                // W6b①: 群体均速`]);

E.push([`      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumZ += Z[j]; }   // 第 8 轮`,
`      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumZ += Z[j]; sumVX += V[2*j]; sumVY += V[2*j+1]; }   // 第 8 轮 + W6b①`]);

E.push([`  PC.z = cnt ? sumZ / cnt : Z_INIT;          // 视野内鸟群的平均高度(参考)`,
`  PC.z = cnt ? sumZ / cnt : Z_INIT;          // 视野内鸟群的平均高度(参考)
  /* W6b①: 视野内椋鸟的群体均速 —— 设伏方的前置拦截解用它外推鸟群走向(乘 p7 前置时间倍率)。 */
  PC.mvx = cnt ? sumVX / cnt : 0; PC.mvy = cnt ? sumVY / cnt : 0;`]);

E.push([`    let sc = base * (1 + DIR_LAG * ((CANDX[k] / d) * ux + (CANDY[k] / d) * uy));
    // 扩展位: 雁权重 / 威慑锥扣分 / mob 扣分
    if (coneOn && inCone(px + CANDX[k], py + CANDY[k])) sc *= CONE_SCORE_FACTOR;`,
`    let sc = base * (1 + DIR_LAG * ((CANDX[k] / d) * ux + (CANDY[k] / d) * uy));
    // 扩展位: 雁权重 / 威慑锥扣分 / mob 扣分
    if (coneOn && inCone(px + CANDX[k], py + CANDY[k])) sc *= CONE_SCORE_FACTOR;
    /* W6b④ 事件双打: 候选点若落在"那次冲刺方向的反方向 ±60° 扇区"内, 打分 ×F_EVT_BIAS。
     * 语义 = 追猎方把鸟群往某侧赶/某侧刚被扫过, 其余隼去补它的反方向(而不是全挤在同一点)。 */
    if (biasDir !== undefined && biasDir !== null) {
      const bk = (CANDX[k] / d) * Math.cos(biasDir) + (CANDY[k] / d) * Math.sin(biasDir);
      if (bk >= F_EVT_COS) sc *= F_EVT_BIAS;
    }`]);

/* ================= ④ 牧羊位/拦截位辅助函数 + tryDash 事件 ================= */
E.push([`// tryDash: 发起冲刺。带 ±60° 方向约束 —— 目标必须在当前航向 60° 以内,`,
`/* W6b②: 牧羊位 = 质心与设伏方连线的延长线上、质心外侧 F_SHEPHERD_R 处; 结果写 SHEP(零分配)。
 * rank = 0 正是施工单定义的牧羊位; rank ≠ 0(≥3 只隼时的其余隼)把基向扇形错开 rank×30°,
 * 避免它们与追猎方叠在同一点 —— 这是施工单"其余也按各自牧羊位站位"的几何落点。 */
function shepherdPoint(pc, ambusher, rank) {
  const cx = pc.x, cy = pc.y;
  const ax = minImageX(ambusher.x - cx), ay = minImageY(ambusher.y - cy);
  const an = Math.hypot(ax, ay);
  if (an < 1e-6) return false;                    // 设伏方就在质心上 -> 调用方回退到质心
  let dx = -ax / an, dy = -ay / an;               // 质心外侧(背离设伏方)
  if (rank) {
    const th = rank * (Math.PI / 6), ct = Math.cos(th), st = Math.sin(th);
    const nx = dx * ct - dy * st, ny = dx * st + dy * ct;
    dx = nx; dy = ny;
  }
  SHEP.x = wrapX(cx + dx * F_SHEPHERD_R);
  SHEP.y = wrapY(cy + dy * F_SHEPHERD_R);
  return true;
}
/* W6b②: 非追猎方(且非设伏方)的扇形序号: +1,-1,+2,-2…(确定性, 不消耗随机数)。 */
function shepherdRank(fi) {
  let r = 0;
  for (let k = 0; k < falcons.length; k++) {
    if (k === activeId || k === ambushId) continue;
    if (k === fi) break;
    r++;
  }
  const step = Math.floor(r / 2) + 1;
  return (r % 2 === 0) ? step : -step;
}

// tryDash: 发起冲刺。带 ±60° 方向约束 —— 目标必须在当前航向 60° 以内,`]);

E.push([`  f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6: 新链从零开始(账单/哨兵不能跨链残留)
  f.chainS = dashFrames;
  return true;
}`,
`  f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6: 新链从零开始(账单/哨兵不能跨链残留)
  f.chainS = dashFrames;
  /* W6b④ 冲刺事件: 记录"本帧哪只隼、朝哪个方向发起冲刺"(供 6.8 末尾给其余隼发事件双打牌),
   * 并消费自己的偏向角 —— 偏向只作用于"下一次冲刺"的捞勺打分, 用过即清。 */
  if (f.kind === "falcon") {
    evtDashDir = Math.atan2(f.vy, f.vx);
    evtDashBy = falcons.indexOf(f);
    if (f.biasDir !== null && f.biasDir !== undefined) { stats.evtBiasDashes++; f.biasDir = null; }
    f.evtDouble = 0;
  }
  return true;
}`]);

/* ================= ⑤ 6.8 隼段: 角色/共享感知/牧羊/事件双打 ================= */
E.push([`  /* ---- 6.8 隼: 能量轮换 + 拦截位配合 + (围攻/眩晕/驱逐) + 策略参数(P3) ---- */
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const isActive = fi === activeId;
    const hpk = hTurnPen(f);                   // W8: 驱逐鸟压力 -> 转向类参数倍率(1-0.02L)`,
`  /* ---- 6.8 隼: 能量轮换 + 牧羊/设伏/共享感知/事件双打 + (围攻/眩晕/驱逐) + 策略参数(P3) ----
   * W6b(T1b) 四件套: ①拦截位前置解(p7) ②牧羊位 ③共享感知 ④事件双打; ⑤同盟豁免在 6.10。 */
  evtDashDir = null; evtDashBy = -1;           // W6b④: 本帧冲刺事件清零(由 tryDash 写入)
  /* W6b②: 设伏方 = 非追猎方里离质心最近者(2 只隼 = 另一只; ≥3 只才有歧义; 1 只 = 无设伏方)。 */
  ambushId = -1;
  if (falcons.length === 2) ambushId = (activeId + 1) % 2;
  else if (falcons.length > 2) {
    let bd = 1e18;
    for (let k = 0; k < falcons.length; k++) {
      if (k === activeId) continue;
      const adx = minImageX(falcons[k].x - cxmI), ady = minImageY(falcons[k].y - cymI);
      const ad2 = adx * adx + ady * ady;
      if (ad2 < bd) { bd = ad2; ambushId = k; }
    }
  }
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const isActive = fi === activeId;
    const isAmbush = fi === ambushId;          // W6b②: 设伏方 / 牧羊位
    const hpk = hTurnPen(f);                   // W8: 驱逐鸟压力 -> 转向类参数倍率(1-0.02L)`]);

E.push([`    const pc = f.dashT > 0 ? null : perceive(f.x, f.y, f.vx, f.vy, VIEW_FALCON_R2);
    f.seeing = !!pc;
    if (pc) {
      f.memX = pc.x; f.memY = pc.y; f.memT = frame;`,
`    const pcOwn = f.dashT > 0 ? null : perceive(f.x, f.y, f.vx, f.vy, VIEW_FALCON_R2, f.biasDir);
    f.seeing = !!pcOwn;
    if (pcOwn) {
      f.memX = pcOwn.x; f.memY = pcOwn.y; f.memT = frame;
      copyPC(f.lastPC, pcOwn); f.lastPC.frame = frame;   // W6b③: 自己的本帧结果(按值; 也是共享给别人的源)
    }
    /* W6b③ 共享感知: 设伏方在自己 perceive 为 null 或目标 >F_SHARE_R 时, 改用追猎方**上一帧**的 pc。
     * SHARED_PC 在上一帧末尾从追猎方的 lastPC 拷贝而来, 这里严格校验 frame 戳(= frame-1),
     * 绝不使用更旧的快照(不留过期目标)。拷贝进 f.lastPC 后当"本帧的 pc"用, 不借引用。 */
    let pc = pcOwn;
    if (!isActive && f.dashT === 0) {
      const ownTgtD = (pcOwn && pcOwn.cx >= 0)
        ? Math.hypot(minImageX(pcOwn.cx - f.x), minImageY(pcOwn.cy - f.y)) : Infinity;
      if ((!pcOwn || ownTgtD > F_SHARE_R) && SHARED_PC.frame === frame - 1) {
        copyPC(f.lastPC, SHARED_PC);
        pc = f.lastPC;
        f.sharedUses++; stats.sharedPcUses++;
      }
    }
    if (pc) {`]);

E.push([`      if (isActive) {
        // 追猎方: 视野内朝群体质心修正, 看不见就飞向记忆点
        if (pc) {
          const dfx = minImageX(pc.x - f.x), dfy = minImageY(pc.y - f.y);
          const df = Math.hypot(dfx, dfy);
          if (df > 200) { f.vx += dfx / df * 0.6; f.vy += dfy / df * 0.6; }
        } else if (freshMem(f)) {`,
`      if (isActive) {
        /* W6b② 牧羊位: 追猎方的巡航目标 = 质心与设伏方连线的延长线上、质心外侧 F_SHEPHERD_R
         * (设伏方不可见/就是质心时回退到质心)。只改巡航走位, 冲刺决策仍用捞勺采样结果。 */
        let crx = pc ? pc.x : 0, cry = pc ? pc.y : 0;
        if (pc && ambushId >= 0 && shepherdPoint(pc, falcons[ambushId], 0)) { crx = SHEP.x; cry = SHEP.y; stats.shepherdFrames++; }
        // 追猎方: 视野内朝牧羊位(回退: 质心)修正, 看不见就飞向记忆点
        if (pc) {
          const dfx = minImageX(crx - f.x), dfy = minImageY(cry - f.y);
          const df = Math.hypot(dfx, dfy);
          if (df > 200) { f.vx += dfx / df * 0.6; f.vy += dfy / df * 0.6; }
        } else if (freshMem(f)) {`]);

E.push([`      } else {
        // 设伏方: 不算全局鸟群, 只用自己视野里的质心推拦截位 ——
        // 鸟群总朝远离追猎方的方向逃, 逃逸走廊的尽头就是设伏点(p4 外推比例可学)。
        let travel = false, tx = 0, ty = 0, d = 0;
        if (pc) {
          const af = falcons[activeId];
          const ax0 = minImageX(pc.x - af.x), ay0 = minImageY(pc.y - af.y);
          const ipx = wrapX(pc.x + ax0 * PV_.interceptAhead);
          const ipy = wrapY(pc.y + ay0 * PV_.interceptAhead);
          tx = minImageX(ipx - f.x); ty = minImageY(ipy - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        } else if (freshMem(f)) {`,
`      } else {
        /* W6b①②: 非追猎方分两种角色 —— 设伏方去拦截位(质心 + 群体均速 × min(120, 追猎距离/8.5 +
         * 自身距离/7.5) × p7); 牧羊位(≥3 只隼时的其余隼)去各自的牧羊位(基向扇形错开 rank×30°)。
         * 两者都只用自己的视野信息(不读全局质心), 与旧设伏方的原则一致。 */
        let travel = false, tx = 0, ty = 0, d = 0;
        if (pc && !isAmbush && ambushId >= 0) {
          if (shepherdPoint(pc, falcons[ambushId], shepherdRank(fi))) {
            tx = minImageX(SHEP.x - f.x); ty = minImageY(SHEP.y - f.y);
            d = Math.hypot(tx, ty);
            travel = d > INTERCEPT_MIN;
            stats.shepherdFrames++;
          }
        } else if (pc) {
          const af = falcons[activeId];
          const dHunter = Math.hypot(minImageX(pc.x - af.x), minImageY(pc.y - af.y));
          const dSelf = Math.hypot(minImageX(pc.x - f.x), minImageY(pc.y - f.y));
          const leadT = Math.min(F_INTERCEPT_MAX, dHunter / DASH_SPEED + dSelf / REST_SPEED) * PV_.leadK;
          const ipx = wrapX(pc.x + pc.mvx * leadT);
          const ipy = wrapY(pc.y + pc.mvy * leadT);
          tx = minImageX(ipx - f.x); ty = minImageY(ipy - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        } else if (freshMem(f)) {`]);

E.push([`        // 偶发双打(p3): 设伏方能量很满且采样到可用目标时, 不等接棒直接出手
        if (f.circleT <= 0 && f.energy >= PV_.doubleTeam && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体
        logDec(1, fi, "双隼夹击冲刺: 能量 " + f.energy.toFixed(0) + " 锁定#" + pc.lockIdx);
      } else { f.circleT = 10; logDec(2, fi, "夹击冲刺落空(航向夹角过大)"); }
        }`,
`        /* W6b④ 事件双打(取代 W4 的能量双打 p3): 只有被"任一隼成功发起冲刺"这一事件点名的隼
         * (f.evtDouble, 由隼段末尾统一发牌)才出手。旧的 energy ≥ PV_.doubleTeam 门控已删除,
         * p3/P_DOUBLE_TEAM 参数位保留但标注 deprecated(不被读取)。 */
        if (f.circleT <= 0 && f.stun <= 0 && pc && f.evtDouble) {
          if (f.energy < PV_.dashMin) { f.circleT = 6; }        // 能量不够: 牌留着, 回能后再出手
          else if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体
        logDec(1, fi, "配合双打冲刺(事件触发): 能量 " + f.energy.toFixed(0) + " 锁定#" + pc.lockIdx +
               " 偏向 " + (f.biasDir === null || f.biasDir === undefined ? "无" : (f.biasDir * 180 / Math.PI).toFixed(0) + "°"));
      } else { f.circleT = 10; logDec(2, fi, "配合双打冲刺落空(航向夹角过大)"); }
        }`]);

E.push([`        for (const r of raptors) {
          if (r === f) continue;
          const dx = minImageX(r.x - f.x), dy = minImageY(r.y - f.y);`,
`        for (const r of raptors) {
          if (r === f) continue;
          if (r.kind === f.kind) continue;      // W6b⑤ 同盟豁免: 驱逐冲刺跳过同 kind(隼不驱逐隼)
          const dx = minImageX(r.x - f.x), dy = minImageY(r.y - f.y);`]);

E.push([`    trailPush(f, f.x, f.y, GRAV_ON ? f.z : Z_INIT);
  }

  /* ---- 6.85 W4 雁隼(ghunter): 雁专猎手 --------------------------------------`,
`    trailPush(f, f.x, f.y, GRAV_ON ? f.z : Z_INIT);
  }
  /* W6b④ 事件双打的统一发牌(放在隼段末尾: 这样"本帧已经跑过的那只隼"也能收到牌)。
   * 语义: 任一隼 tryDash 成功当帧, 其余隼若 energy ≥ 各自 dashMin 则 circleT=0(立刻可出手),
   * 并给它下一次冲刺的偏向角 = 那次冲刺方向的**反方向**(其捞勺打分对 ±60° 扇区候选点 ×F_EVT_BIAS)。 */
  if (evtDashDir !== null) {
    for (let k = 0; k < falcons.length; k++) {
      if (k === evtDashBy) continue;
      const g = falcons[k];
      if (g.energy >= policyVals(g).dashMin) {
        g.circleT = 0;
        g.biasDir = ((evtDashDir + Math.PI) % TAU + TAU) % TAU;
        g.evtDouble = 1;
        stats.eventDoubles++;
      }
    }
  }
  /* W6b③: 把追猎方**本帧**的 pc 按值存进 SHARED_PC —— 下一帧供设伏方共享(frame 戳 = 上一帧)。 */
  if (activeId >= 0 && activeId < falcons.length) {
    const hf = falcons[activeId];
    if (hf.lastPC && hf.lastPC.frame === frame) { copyPC(SHARED_PC, hf.lastPC); SHARED_PC.frame = frame; }
  }

  /* ---- 6.85 W4 雁隼(ghunter): 雁专猎手 --------------------------------------`]);

/* ================= ⑥ 6.10 互攻: 同盟豁免 ================= */
E.push([`      lose.dashT = 0; lose.lockIdx = -1;
      lose.score -= CLASH_COST;
      const stolen = lose.score > 0 ? Math.floor(lose.score * STEAL_FRAC) : 0;
      lose.score -= stolen;
      win.score += stolen;
      win.dashEats++;                                // 胜方免空冲刺罚款
      // 鹰的奖惩要走 pending, 否则 Q 学习看不见互攻这件事
      if (win.kind === "eagle") win.pending += stolen;
      logDec(4, 255, win.label.split(" ")[0] + " 驱逐成功(抢分 " + stolen + ")");
      if (lose.kind === "eagle") lose.pending -= CLASH_COST;
      A.clashCd = CLASH_CD; B.clashCd = CLASH_CD;
      stats.clashes++;
      if (stolen > 0) stats.steals++;`,
`      lose.dashT = 0; lose.lockIdx = -1;
      /* W6b⑤ 同盟豁免: falcon-falcon 保留击退+眩晕+CLASH_CD(上面已生效), 废除 CLASH_COST 扣分与
       * STEAL_FRAC 抢分 —— 扣分/抢分只对 鹰/雁隼 生效。面板互攻计数 stats.clashes 不变。
       * 取证: stats.falconClashes 记免罚次数, stats.falconSteals 恒 0(判据),
       *       stats.falconAvoided 记"反事实本会扣/抢多少分"(证明豁免真的拦下了转移)。 */
      const allyExempt = (A.kind === "falcon" && B.kind === "falcon");
      if (allyExempt) {
        const would = CLASH_COST + (lose.score > 0 ? Math.floor(lose.score * STEAL_FRAC) : 0);
        stats.falconClashes++;
        stats.falconAvoided += would;
        logDec(4, 255, win.label.split(" ")[0] + " 同盟驱逐(免扣分/免抢分 " + would + ")");
      } else {
        lose.score -= CLASH_COST;
        const stolen = lose.score > 0 ? Math.floor(lose.score * STEAL_FRAC) : 0;
        lose.score -= stolen;
        win.score += stolen;
        // 鹰的奖惩要走 pending, 否则 Q 学习看不见互攻这件事
        if (win.kind === "eagle") win.pending += stolen;
        logDec(4, 255, win.label.split(" ")[0] + " 驱逐成功(抢分 " + stolen + ")");
        if (lose.kind === "eagle") lose.pending -= CLASH_COST;
        if (stolen > 0) stats.steals++;
      }
      win.dashEats++;                                // 胜方免空冲刺罚款
      A.clashCd = CLASH_CD; B.clashCd = CLASH_CD;
      stats.clashes++;`]);

/* ================= ⑦ stats / 面板 / SIM 钩子 / reset ================= */
E.push([`                chainBillEnds: 0,                // W6: 链因能量账单越线(每口 1.5^n, F_CHAIN_BITES)而收尾的次数`,
`                chainBillEnds: 0,                // W6: 链因能量账单越线(每口 1.5^n, F_CHAIN_BITES)而收尾的次数
                // ---- W6b(T1b) 隼·配合四件套 ----
                shepherdFrames: 0,               // W6b②: 隼把牧羊位当选巡航目标的帧数(含牧羊位隼)
                sharedPcUses: 0,                 // W6b③: 设伏方改用追猎方上一帧 pc 的帧数
                eventDoubles: 0,                 // W6b④: 事件双打发牌次数(其余隼 circleT 归零)
                evtBiasDashes: 0,                // W6b④: 带偏向扇区发起冲刺的次数(偏向被真正用上)
                falconClashes: 0,                // W6b⑤: 隼-隼互攻(免扣分/免抢分)次数
                falconSteals: 0,                 // W6b⑤: 隼-隼抢分额 —— 同盟豁免判据, 必须恒 0(代码路径已跳过)
                falconAvoided: 0,                // W6b⑤: 因豁免而未扣/未抢的分数(反事实记账)`]);

E.push([`    \` · 链终止: 能量 \${stats.chainEnergyEnds}/预算 \${stats.chainBudgetEnds}/账单 \${stats.chainBillEnds}\` +
    \` · dashMaxEats \${stats.dashMaxEats}/锁定 \${stats.dashMaxEatsLocked}/自由 \${stats.dashMaxEatsFree}<br>\` +`,
`    \` · 链终止: 能量 \${stats.chainEnergyEnds}/预算 \${stats.chainBudgetEnds}/账单 \${stats.chainBillEnds}\` +
    \` · dashMaxEats \${stats.dashMaxEats}/锁定 \${stats.dashMaxEatsLocked}/自由 \${stats.dashMaxEatsFree}<br>\` +
    \`配合四件套(W6b): 牧羊位 \${stats.shepherdFrames} 帧 · 共享感知 \${stats.sharedPcUses} 帧 · 事件双打 \${stats.eventDoubles} 次(偏向冲刺 \${stats.evtBiasDashes})\` +
    \` · 同盟豁免 隼-隼 \${stats.falconClashes} 次(抢分 \${stats.falconSteals}/免 \${stats.falconAvoided}) · p7 前置倍率 \${falcons[0] ? policyVals(falcons[0]).leadK.toFixed(2) : "—"}<br>\` +`]);

E.push([`  // 验收用: 把三只猛禽挪到远角(可每帧调用, 模拟"无猛禽干扰"的鸟群)`,
`  // W6b(T1b): 配合四件套常量与实时状态(验收/面板共用)
  get t1bConst() { return { SHEPHERD_R: F_SHEPHERD_R, SHARE_R: F_SHARE_R, EVT_BIAS: F_EVT_BIAS, EVT_SECTOR_DEG: 60,
    INTERCEPT_MAX: F_INTERCEPT_MAX, LEAD: P_LEAD_TIME.slice(), ES_NP,
    DEPRECATED: ["P_DOUBLE_TEAM(p3)", "P_INTERCEPT(p4)", "INTERCEPT_AHEAD", "DOUBLE_TEAM_E", "PV_.interceptAhead"] }; },
  get t1bInfo() {
    return falcons.map((f, k) => ({
      id: k, role: k === activeId ? "hunter" : (k === ambushId ? "ambush" : "shepherd"),
      lastPC: f.lastPC ? { cx: f.lastPC.cx, cy: f.lastPC.cy, lockIdx: f.lastPC.lockIdx, score: f.lastPC.score,
                           n: f.lastPC.n, mvx: f.lastPC.mvx, mvy: f.lastPC.mvy, frame: f.lastPC.frame } : null,
      biasDirDeg: (f.biasDir === null || f.biasDir === undefined) ? null : +(f.biasDir * 180 / Math.PI).toFixed(1),
      evtDouble: f.evtDouble || 0, sharedUses: f.sharedUses || 0, leadK: +policyVals(f).leadK.toFixed(3),
      shepherdR: F_SHEPHERD_R, shareR: F_SHARE_R,
    }));
  },
  // 验收用: 把三只猛禽挪到远角(可每帧调用, 模拟"无猛禽干扰"的鸟群)`]);

E.push([`    f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6
    f.z = 140; f.vz = 0; f.targetZ = -1;                              // 第 8 轮`,
`    f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6
    f.lastPC = makePC(); f.sharedUses = 0; f.biasDir = null; f.evtDouble = 0;   // W6b
    f.z = 140; f.vz = 0; f.targetZ = -1;                              // 第 8 轮`]);

E.push([`  activeId = 0;
  syncRaptorRefs();`,
`  activeId = 0;
  ambushId = -1; evtDashDir = null; evtDashBy = -1; SHARED_PC.frame = -1e9;   // W6b: 四件套帧间状态清零
  syncRaptorRefs();`]);

/* ---------- 执行 ---------- */
let src = fs.readFileSync(HTML, "utf8");
const APPLY = process.argv.includes("--apply");
let applied = 0, skipped = 0;
const missed = [];
for (const [from, to] of E) {
  const n = src.split(from).length - 1;
  if (n === 0) {
    const marker = to.split("\n").slice(-3).join("\n");
    if (src.includes(marker)) { skipped++; console.log("已应用(跳过):", JSON.stringify(from.split("\n")[0].slice(0, 46))); }
    else missed.push("NOT FOUND: " + from.split("\n")[0].slice(0, 80));
    continue;
  }
  if (n > 1) { missed.push("AMBIGUOUS(" + n + "): " + from.split("\n")[0].slice(0, 80)); continue; }
  src = src.replace(from, to);
  applied++;
}
console.log("applied=" + applied + " skipped=" + skipped + " missed=" + missed.length + " total=" + E.length);
if (missed.length) { console.log("MISSED:"); for (const m of missed) console.log("  - " + m); }
if (APPLY && missed.length === 0) {
  fs.writeFileSync(HTML, src);
  console.log("WROTE", HTML, src.length, "bytes");
} else if (APPLY) {
  console.log("有未命中的锚点, 不写回");
  process.exit(2);
}
