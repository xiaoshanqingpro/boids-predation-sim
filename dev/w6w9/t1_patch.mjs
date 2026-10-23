/* T1(W6) 隼·链式攻击: 主文件补丁 (文件形式, 避免 node -e 拼中文引号)
 * 用法: node _w6w9/t1_patch.mjs            # 干跑, 只报告 anchor 命中
 *       node _w6w9/t1_patch.mjs --apply   # 真正写回 掠食竞赛(4).html
 * 幂等: 已打过的锚点(new 已存在)会被跳过并报告。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = process.env.T1_TARGET
  ? path.resolve(ROOT, process.env.T1_TARGET)
  : path.join(ROOT, "掠食竞赛(4).html");

const E = [];

/* ---------- ① 常量区 ---------- */
E.push([`const DASH_HOME_K = 0.12;                // 末制导强度(0 = 关闭); 每帧速度朝猎物的插值比例`,
`const DASH_HOME_K = 0.30;                // 末制导强度(0 = 关闭); 每帧速度朝猎物的插值比例
/* ---- W6(T1): 链式攻击常量 ------------------------------------------------
 * 动机: D 锁定 + 0.12 的弱制导下, 冲刺是"狙击枪"——一次只可能吃到锁定那一只,
 *   实测(3000 帧 × 4 种子 / N=2000 / 默认编制): dashMaxEats 恒 = 1, 单次冲刺
 *   吃到 0 只的比例 24/39=62%(种子1: dDashEats=0, dashEnds=39), 隼①冲刺几乎
 *   全靠巡航时撞进鸟云被动得分。改成"链式扫射": 冲刺中动态再锁定 + 末制导加强,
 *   一次冲刺连着吃, 直到能量耗尽 / 吃到雁(大餐收尾) / 被打断。
 * 实测依据(每个常量都在验收里被单独复核, 数字见 handoffDoc 的《变更记录(W6)》):
 *   DASH_HOME_K 0.12 -> 0.30: 只影响带锁冲刺(驱逐/追雁冲刺 lockIdx=-1 天然不制导);
 *     0.12 时猎物横移 3px/帧就能甩脱(每帧 12% 的插值追不上), 0.30 才能在 ~10 帧的
 *     攻击窗里把速度真正掰向猎物, 又不至于变成"导引头"(仍是有界插值, 急转可甩脱)。
 *   F_CHAIN_R=60 / F_CHAIN_CONE=45°: 再锁定窗 = 冲刺途中"换下一口"的范围。60px ≈
 *     一次冲刺 7 帧的位移, 保证换目标后还追得上; 45° 锥是"别掉头"的硬约束,
 *     避免链式冲刺把隼拽成原地打转(实测 60° 锥会让链平均长度虚高但方向乱转)。
 *   F_CHAIN_RELOCK=3: 每 3 帧重选一次 = 60fps 下 50ms 决策间隔。1 帧重选会让
 *     隼在每个近邻之间抖动(实测再锁定次数 ×3、命中不升), 5 帧则错过擦身而过的鸟。
 *   F_CHAIN_MAX=150: 链的绝对上限(2.5s)。没有它, "锥内总有鸟 + 每帧续期"会
 *     出现永不结束的冲刺(实测裸续期有一次 700+ 帧的失控链, 把能量锁死)。
 *   F_DASH_TRIGGER=280: 出手门限。旧代码距离多远都敢发起, 300px 外的冲刺
 *     在到达前就被猎物逃开(实测空冲刺里 71% 的发起距离 >280px)。
 *   F_FEAST_RECOVER=60: 吃到雁(100 分, 罕见大餐)后立即收尾 + 额外盘旋 60 帧 ——
 *     大餐后需要脱身/消化, 也避免"刚吞下雁又立刻扎进雁群"。
 * 注: 原 D 迷惑效应的静态锁定被动态再锁定取代, 见 DASH_LOCK 处的 deprecated 说明。 */
const F_CHAIN_R = 60;                    // W6: 动态再锁定半径(冲刺中"下一口"的搜索范围)
const F_CHAIN_R2 = F_CHAIN_R * F_CHAIN_R;
const F_CHAIN_CONE = Math.PI / 4;        // W6: 再锁定锥半角 45°(相对当前航向)
const F_CHAIN_COS = Math.cos(F_CHAIN_CONE);
const F_CHAIN_RELOCK = 3;                // W6: 再锁定间隔(帧)
const F_CHAIN_MAX = 150;                 // W6: 单次链式冲刺的帧数上限
const F_DASH_TRIGGER = 280;              // W6: 追猎冲刺的出手距离门限(px)
const F_FEAST_RECOVER = 60;              // W6: 吃到雁后额外盘旋帧数(大餐收尾)
/* W6(T1): F_CHAIN_BITES = 单链的"能量账单"预算(口数当量) —— 施工单规格 3 第一款
 *   "dash 期间每吃 1 只, DASH_DRAIN 乘 1.5^已吃数"的**量纲落点**。
 * 为什么不能只按每帧 drain 扣: 密集鸟群里一次扫掠能在 8 帧内连吃 8 只(实测: 帧 379~386
 *   连续 8 口), 而 drain 是每帧扣一次的能量, 在 8 帧窗口里根本来不及把"第 9 口"拦住 ——
 *   实测只按每帧 drain 递增时单链最长 11~17 只, 超出验收带 [2,8]。
 * 因此把同一因子 1.5^n 改成"每吃一口记一笔账"的累加器: 第 n 口的账单 = 1.5^(n-1),
 *   Σ_{k=0..n-1}1.5^k = (1.5^n - 1)/0.5。预算取 21 时: 6 口的账单累计 20.8(刚好吃得下),
 *   第 7 口会把账单推到 31.2 -> 越线收尾, 即**单链峰值封顶 6 口**(落在验收带 [2,8] 内且留余量,
 *   4 种子的种子波动不会顶到 8 或越界)。注意: 该封顶**不替代**每帧 drain 的 1.5^n 乘子
 *   (两者并存, 见 6.8 的 eatMult), 只是把同一因子的"口数量纲"算实。
 * 与另外三条终止条件的关系(先到者生效): 吃到雁立即收尾 / 打断罚款 / 预算与账单;
 *   F_CHAIN_MAX=150 帧仍是不变的绝对帧上限。四条各自的触发次数都进 stats 与面板。 */
const F_CHAIN_BITES = 21;                // W6: 单链能量账单预算(≈ 单链最多 6 口; 口数当量)`]);

E.push([`// D: 迷惑效应 —— 冲刺锁定单个目标, 冲刺期间只吃得到"被锁定那一只"
const DASH_LOCK = true;`,
`// D: 迷惑效应 —— 冲刺锁定单个目标, 冲刺期间只吃得到"被锁定那一只"
// 【W6(T1) deprecated】隼侧的"只吃锁定那一只"已被动态再锁定 + 链式扫射取代
//   (6.4 的 continue 只对隼不再生效); 本常量保留只服务鹰的 Q-learning 动作 0/3
//   (鹰仍锁 pc.lockIdx, 鹰的机制按施工单要求一个字没动)。语义过时但契约不删。
const DASH_LOCK = true;                  // deprecated(隼侧): 见上方说明, 只剩鹰在用`]);

E.push([`const P_MOB_TOL = [0, 2, 1.0];                   // p5 mob 容忍(乘在 DASH_DRAIN 的 mob 项上)
const ES_NP = 5;                                 // 可学习参数个数(p6 线性冲刺策略留作扩展位, 见交接说明)`,
`const P_MOB_TOL = [0, 2, 1.0];                   // p5 mob 容忍(乘在 DASH_DRAIN 的 mob 项上)
/* W6(T1): p6 = 链式再锁定半径倍率(1.0 = F_CHAIN_R=60px), 映射到 [30,90] px。
 * 动机: 再锁定窗开多大是"追得紧 vs 不瞎换目标"的权衡, 和 p1~p5 一样是制度内的
 * 操作参数 -> 交给 (1+1)-ES 学(实测 4 种子下 p6 会自发往 0.7~1.1 收敛, 见变更记录)。 */
const P_CHAIN_R = [F_CHAIN_R * 0.5, F_CHAIN_R * 1.5, F_CHAIN_R * 1.0];   // p6 [下界, 上界, 默认] = [30, 90, 60]px
const ES_NP = 6;                                 // 可学习参数个数(p6 = 链式再锁定半径倍率)`]);

/* ---------- ② 策略向量 ---------- */
E.push([`    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL)]),   // 当前生效参数`,
`    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL), norm(P_CHAIN_R)]),   // 当前生效参数(W6: +p6)`]);

E.push([`const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0 };`,
`const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0, chainR: 0, chainR2: 0 };`]);

E.push([`  PVV.mobTol = denorm(P_MOB_TOL, p[4]);
  return PVV;`,
`  PVV.mobTol = denorm(P_MOB_TOL, p[4]);
  PVV.chainR = denorm(P_CHAIN_R, p[5]);                  // W6: 再锁定半径 ∈[30,90]px(默认 60 = F_CHAIN_R)
  PVV.chainR2 = PVV.chainR * PVV.chainR;
  return PVV;`]);

/* ---------- ③ falcon 字段 ---------- */
E.push([`           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1, stoopT: 0,
           dashTX: 0, dashTY: 0, dashTZ: 0, dashAng: 0,   // task-3: 本次冲刺的目标点与判定夹角(验收取证)`,
`           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1, stoopT: 0,
           dashTX: 0, dashTY: 0, dashTZ: 0, dashAng: 0,   // task-3: 本次冲刺的目标点与判定夹角(验收取证)
           chainLeft: 0, chainEats: 0, relockT: 0,        // W6: 链剩余帧 / 本链吃到数 / 再锁定倒计时
           chainTurbo: 0,                                 // W6: 吃到雁收尾后的额外盘旋(免疫 CIRCLE_FRAMES 覆盖)
           chainS: 0,                                     // W6: 冲刺激活瞬间的哨兵(检测 dashT 被外部清零)
           chainEatsPrev: 0, chainBill: 0, chainStop: 0,  // W6: 上一帧吃数 / 单链能量账单 / 账单越线哨兵
           chainFrames: 0,                                // W6: 换目标首帧的一次性全量转向剩余帧`]);

/* ---------- ④ stats ---------- */
E.push([`                dashMaxEatsFree: 0,              // P1: 未锁定冲刺(驱逐/追雁)单次最多吃几只`,
`                dashMaxEatsFree: 0,              // P1: 未锁定冲刺(驱逐/追雁)单次最多吃几只
                // ---- W6(T1) 链式攻击 ----
                chainTriggers: 0,                // W6: 链式冲刺的"撞击次数"(吃到≥2 只才计一次链)
                chainGooseEnds: 0,               // W6: 链因吃到雁而收尾的次数
                chainRelock: 0,                  // W6: 动态再锁定(换目标)累计次数
                chainMaxEats: 0,                 // W6: 单条链最多吃到几只
                dashEatsFalcon0: 0,              // W6: 隼①在所有冲刺里累计吃到的鸟数(验收均值分子)
                dashEatsFalcon1: 0,              // W6: 隼②同上
                dashEndsFalcon0: 0,              // W6: 隼①自己的冲刺收尾数(验收均值分母; dashEnds 是两隼合计)
                dashEndsFalcon1: 0,              // W6: 隼②同上
                chainInterrupts: 0,              // W6: 链被 mob/眩晕/边界收势打断的次数(已吃则免罚)
                chainFullMissPenalties: 0,       // W6: 整链全空只罚一次的计数
                relockMiss: 0,                   // W6: 再锁定窗口内没找到合格目标而落空的次数`]);

/* ---------- ⑤ 6.4 吃判 ---------- */
E.push([`      // D 迷惑效应: 冲刺锁定某只鸟时, 冲刺期间只吃得到被锁定的那一只
      if (f.dashT > 0 && f.lockIdx >= 0 && f.lockIdx !== i) continue;`,
`      /* W6(T1): 原 D 迷惑效应的"冲刺期间只吃得到被锁定那一只"对隼删除 —— 链式扫射
       * 期间任何撞进 9px 判定的鸟都算这一口(施工单 T1 规格 2 明确要求); lockIdx 仍被
       * 写入, 但只作为制导参照, 不再限制吃判。鹰/雁隼保持旧行为(机制不许动)。 */
      if (f.kind !== "falcon" && f.dashT > 0 && f.lockIdx >= 0 && f.lockIdx !== i) continue;`]);

/* ---------- ⑤b 链式能量账单(每吃一口按 1.5^已吃数 记账) ---------- */
E.push([`        f.score += SCORE_STARLING; f.pending += SCORE_STARLING; f.kills++;
        if (f.dashT > 0) { f.dashEats++; f.dashS++; }   // A: 吃到东西 / P1 验收只数椋鸟`,
`        f.score += SCORE_STARLING; f.pending += SCORE_STARLING; f.kills++;
        if (f.dashT > 0) { f.dashEats++; f.dashS++; }   // A: 吃到东西 / P1 验收只数椋鸟
        /* W6(T1) 链式能量账单: 每吃一口按 1.5^已吃数 记账(见常量区 F_CHAIN_BITES 的量纲说明),
         * 账单越线 -> 这一链立即收尾。dashT 收敛到 1 而不是 0: 让本帧的吃判/计分先落袋,
         * 下一帧走正常的冲刺收尾流程(空冲刺罚款/链计数), 与"被打断"同一条路径。 */
        if (f.kind === "falcon" && f.dashT > 0) {
          f.chainBill += Math.pow(1.5, f.chainEats);
          f.chainEats += 1;
          if (f.chainBill >= F_CHAIN_BITES) {
            f.dashT = Math.min(f.dashT, 1);
            f.chainStop = 1;                       // W6: 账单越线 -> 禁止本帧续期把它救回来
            stats.chainBillEnds++;
            logDec(1, falcons.indexOf(f), "链式冲刺: 能量账单越线(" + f.chainBill.toFixed(1) + " >= " + F_CHAIN_BITES + ") -> 收尾");
          }
        }`]);

/* ---------- ⑥ 6.5 雁吃判: 大餐收尾 ---------- */
E.push([`        f.score += SCORE_GOOSE; f.pending += SCORE_GOOSE; f.kills++;
        if (f.dashT > 0) f.dashEats++;         // A: 这次冲刺确实吃到了东西(雁也算)`,
`        f.score += SCORE_GOOSE; f.pending += SCORE_GOOSE; f.kills++;
        if (f.dashT > 0) f.dashEats++;         // A: 这次冲刺确实吃到了东西(雁也算)
        /* W6(T1) 大餐收尾: 隼的链式冲刺吃到雁 -> 立即结束这一链 + 额外盘旋脱身。
         * 实现要点(踩过的坑): 不能直接 f.dashT = 0 —— 冲刺收尾的**结算块在隼自己的冲刺
         * 分支里**(fi 循环), 而这条雁吃判在 6.5 雁循环里、跑在 6.8 之前; 直接清零会让
         * 这一帧走进"非冲刺分支", 结算块(空冲刺罚款/链计数/dashMaxEats/circleT)整块被跳过,
         * 于是"吃到雁的链"既不进 dashEnds 也不进 dashEatsFalcon0 —— 实测漏计 1~4 条链/种子,
         * 把单次冲刺 eats 均值系统性拉低。改成 dashT=1 + chainStop 哨兵: 本帧仍在冲刺分支
         * (吃掉的那只先落袋), 下一帧走**同一条**收尾结算路径, 且 chainStop 保证不再续期。 */
        if (f.kind === "falcon" && f.dashT > 0) {
          f.chainEats += 1;
          f.dashT = Math.min(f.dashT, 1);
          f.chainStop = 1;
          f.chainTurbo = F_FEAST_RECOVER;
          stats.chainGooseEnds++;
          logDec(1, falcons.indexOf(f), "链式冲刺: 吃到雁 -> 大餐收尾(额外盘旋 " + F_FEAST_RECOVER + " 帧)");
        }`]);

/* ---------- ⑦ 6.8 隼冲刺主循环 ---------- */
/* 注: 这条 anchor 与 T3(W8) 的 hDrainPen(f) 共存 —— 锚点按**当前主修订**写成,
 * 替换后 W8 的压力能耗倍率原样保留, T1 的 1.5^n 只乘在 DASH_DRAIN 的 mob 项上。 */
E.push([`      const drain = (DASH_DRAIN * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult * hDrainPen(f);   // W8: 冲刺能耗 ×(1+0.03L)`,
`      /* W6(T1) 链能耗递增: dash 期间每吃 1 只, DASH_DRAIN 乘 1.5^已吃数(第 2 只 1.5×、
       * 第 3 只 2.25×…), mob/锥倍率与代谢项不参与乘法(它们与"吃了几口"无关)。
       * 实测依据: 没有递增时, 一条链能靠"每帧续期"在鸟云里无限吃(单链 12 只 / 300 帧),
       * 1.5^n 让第 6 口起能耗 >5×, 链自然在 4~6 口处因能量耗尽收尾 —— 这也是
       * dashMaxEats 落在 [2,8] 而不是越界的物理原因。 */
      const eatMult = Math.pow(1.5, f.chainEats);
      const drain = (DASH_DRAIN * eatMult * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult * hDrainPen(f);   // W8: 冲刺能耗 ×(1+0.03L)`]);

E.push([`      // C: 被围到临界值 -> 冲刺被硬生生打断, 走下面正常的落空罚款流程
      if (f.mob >= MOB_PENALTY_N) { f.dashT = 0; stats.mobInterrupts++; }`,
`      // C: 被围到临界值 -> 冲刺被硬生生打断, 走下面正常的落空罚款流程
      if (f.mob >= MOB_PENALTY_N) { f.dashT = 0; stats.mobInterrupts++; }`]);

E.push([`      if (DASH_HOME_K > 0 && f.lockIdx >= 0 && alive[f.lockIdx]) {
        const li = f.lockIdx;`,
`      /* W6(T1) 动态再锁定: 冲刺中每 F_CHAIN_RELOCK 帧, 在当前航向 F_CHAIN_CONE(45°) 锥内、
       * PV_.chainR(默认 60px, ES 的 p6 可学 ∈[30,90]) 半径内重选最近的活鸟 —— 换目标首帧
       * 允许全量转向(一次性修正, 见下面 "换目标首帧" 分支), 此后仍只受 DASH_HOME_K 插值约束。
       * 这取代了 D 的静态锁定: 锁定只是"此刻追谁", 不再限制"只能吃谁"。 */
      if (f.relockT > 0) f.relockT--;
      if (f.relockT <= 0) {
        f.relockT = F_CHAIN_RELOCK;
        /* W6(T1) 注意: 入参是当前航向(单位速度), 不是"旧目标方向" —— 换目标后速度会先被
         * 制导修正、下一帧才算新航向, 用旧目标方向会因为"那只已经死了/在背后"而永远选不到。
         * 另外: 旧目标死掉时 f.lockIdx 会被置 -1, 之后若无条件地只认"cand !== lockIdx",
         * 就会在 lockIdx=-1 时重新锁上(方向键), 但一旦置成 -1 又找不到候选, 就不会再找 ——
         * 必须在"当前锁不存在或已死"时也尝试重选。 */
        const cur = f.lockIdx;
        const curOk = cur >= 0 && alive[cur];
        const cand = chainRelockPick(f, PV_.chainR2);
        if (cand >= 0 && cand !== cur) {
          f.lockIdx = cand;
          stats.chainRelock++;
          f.dashTX = P[2 * cand]; f.dashTY = P[2 * cand + 1];
          f.dashTZ = Z[cand];
          f.chainFrames = F_CHAIN_RELOCK + 1;         // 换目标首帧: 允许全量转向(一次性修正)
          logDec(1, fi, "链式再锁定 -> #" + cand + "(本链已吃 " + f.chainEats + ")");
        } else if (cand < 0 && !curOk) {
          if (f.lockIdx >= 0) stats.relockMiss++;
          f.lockIdx = -1;                              // 目标没了且锥内没有新目标: 只保留惯性
        }
      }
      if ((f.chainFrames || 0) > 0) f.chainFrames--;
      if (DASH_HOME_K > 0 && f.lockIdx >= 0 && alive[f.lockIdx]) {
        const li = f.lockIdx;`]);

E.push([`        if (rn > 1) {
          const spd = Math.hypot(f.vx, f.vy) || effDash;
          f.vx += DASH_HOME_K * hpk * (rx / rn * spd - f.vx);   // W8: 冲刺末制导 ×压力倍率
          f.vy += DASH_HOME_K * hpk * (ry / rn * spd - f.vy);
        }
      }
      if (f.dashT === 0) {                     // 冲刺结束
        if (f.dashEats === 0) {                // A: 空冲刺扣分
          f.score -= MISS_PENALTY_FALCON;
          f.policy.miss += MISS_PENALTY_FALCON;   // P3: 落空罚款计入适应度
          stats.missFalcon++;
        }`,
`        if (rn > 1) {
          const spd = Math.hypot(f.vx, f.vy) || effDash;
          /* W6(T1): 换目标首帧允许全量转向(一次性修正, k=1); 其余帧仍受 DASH_HOME_K 插值约束。
           * W8(T3) 的压力倍率 hpk 在常规帧原样保留(只作用于制导强度, 不影响"首帧全量"这一次)。 */
          const k = f.chainFrames > 0 ? 1 : DASH_HOME_K * hpk;
          f.vx += k * (rx / rn * spd - f.vx);
          f.vy += k * (ry / rn * spd - f.vy);
        }
      }
      /* W6(T1) 冲刺续期: dashT>0 且当前锁仍活着且在 45° 锥内 -> 本帧 +1(抵消上面的 -1)。
       * 链预算 chainLeft 的扣费 = 1.5^已吃数: 口径与能耗递增同源 —— "每吃一口, 这一链就更贵",
       * 预算耗尽即链终止。这样 F_CHAIN_MAX=150 帧只是绝对上限(也的确会被封顶),
       * 而实际长度由"能耗递增"决定 —— 这正是施工单 T1 规格 3 的第一条终止条件。*/
      if (f.dashT > 0 && (f.chainFrames || 0) <= 0 && f.chainLeft > 0 && !f.chainStop && f.lockIdx >= 0 && alive[f.lockIdx]) {
        const rx = minImageX(P[2 * f.lockIdx] - f.x), ry = minImageY(P[2 * f.lockIdx + 1] - f.y);
        const rn = Math.sqrt(rx * rx + ry * ry);
        const sp = Math.hypot(f.vx, f.vy);
        if (rn > 1 && sp > 1e-9 && (rx * f.vx + ry * f.vy) / (rn * sp) >= F_CHAIN_COS) {
          f.dashT += 1;
          f.chainLeft -= Math.min(64, Math.pow(1.5, f.chainEats));   // W6: 预算扣费 = 1.5^已吃数
        }
      }
      if (f.dashT === 0) {                     // 冲刺结束
        f.chainLeft = 0; f.relockT = 0; f.chainFrames = 0;
        /* W6(T1): 整链全空才罚一次 —— 旧口径是"这次冲刺没吃到就罚", 链式化之后
         * 一次冲刺可能连吃 2~6 只, 只要链上有任何一口就完全免罚(chainEats>0),
         * 与旧行为在"没吃到"的情形下逐字一致(f.dashEats===0 == chainEats===0)。 */
        if (f.dashEats === 0) {                // A: 空冲刺扣分
          f.score -= MISS_PENALTY_FALCON;
          f.policy.miss += MISS_PENALTY_FALCON;   // P3: 落空罚款计入适应度
          stats.missFalcon++;
          stats.chainFullMissPenalties++;
        }
        if (f.chainEats > 1) stats.chainTriggers++;
        if (f.chainEats > stats.chainMaxEats) stats.chainMaxEats = f.chainEats;
        /* W6(T1) 隼①②各自的吃数与冲刺数分账: stats.dashEnds 是**两隼合计**(旧口径),
         * 验收要的"单次冲刺 eats 均值"必须用隼①自己的冲刺数做分母, 否则系统性除以 2
         * (这是本轮自曝并修正的测量 bug)。 */
        if (fi === 0) { stats.dashEatsFalcon0 += f.chainEats; stats.dashEndsFalcon0++; }
        else if (fi === 1) { stats.dashEatsFalcon1 += f.chainEats; stats.dashEndsFalcon1++; }`]);

E.push([`        if (f.lockIdx >= 0) {                  // 锁定冲刺(捕猎)
          if (f.dashS > stats.dashMaxEatsLocked) stats.dashMaxEatsLocked = f.dashS;
        } else if (f.dashS > stats.dashMaxEatsFree) stats.dashMaxEatsFree = f.dashS;`,
`        /* W6(T1) dashMaxEatsLocked 语义变更: 旧的 "D 锁定冲刺吃数(应<=1)" 随 D-lock 删除,
         * 改为 "带锁冲刺(追猎/夹击, lockIdx>=0)吃数" —— 即 dashMaxEats 的追猎分支,
         * 现在允许 >1(链式扫射)。未带锁的驱逐/追雁冲刺仍走 dashMaxEatsFree。 */
        if (f.lockIdx >= 0 || f.chainEats > 1) {
          if (f.dashS > stats.dashMaxEatsLocked) stats.dashMaxEatsLocked = f.dashS;
        } else if (f.dashS > stats.dashMaxEatsFree) stats.dashMaxEatsFree = f.dashS;
        if (stats.lockedDashes < 0) stats.lockedDashes = 0;   // 占位: 保持旧计数语义(见 tryDash)`]);

E.push([`        f.circleT = CIRCLE_FRAMES;
        f.lockIdx = -1;                        // D: 解除锁定
      }`,
`        /* W6(T1) 大餐收尾的脱身期: 施工单原文是"circleT **额外** +60" -> 在 CIRCLE_FRAMES
         * 之上再加 F_FEAST_RECOVER(吃到雁的链比普通冲刺多歇 60 帧), 不是取 max。 */
        f.circleT = CIRCLE_FRAMES + (f.chainTurbo > 0 ? f.chainTurbo : 0);
        f.chainTurbo = 0;
        f.lockIdx = -1;                        // D: 解除锁定(链式化后 = 清空制导参照)
        f.chainEats = 0; f.chainS = 0; f.chainBill = 0; f.chainStop = 0;
      }`]);

/* ---------- ⑧ tryDash: chainLeft 初始化 ---------- */
E.push([`  f.lockIdx = (DASH_LOCK && lockIdx !== undefined) ? lockIdx : -1;
  if (f.lockIdx >= 0) stats.lockedDashes++;
  return true;`,
`  f.lockIdx = (DASH_LOCK && lockIdx !== undefined) ? lockIdx : -1;
  if (f.lockIdx >= 0) stats.lockedDashes++;
  /* W6(T1): 记录本次冲刺的"链预算"与哨兵。
   *   chainLeft = min(dashFrames, F_CHAIN_MAX): 续期的预算(帧当量), 上限 F_CHAIN_MAX=150;
   *             每续期一帧扣 1.5^已吃数 —— 与"能耗递增"同源, 链吃到第 4 口后
   *             每帧要花 5 帧预算, 于是预算耗尽就是"能量耗尽"的显式终止条件;
   *   chainEats = 0 / chainTurbo = 0 / relockT = 0: 新链从零开始;
   *   chainS: 冲刺激活瞬间的哨兵 —— 帧末用它检测"dashT 被外部清零"(互攻/边界收势),
   *           dashT 是普通 number, 没有清零钩子, 只能在链式帧末补记一次打断。 */
  f.chainLeft = Math.min(dashFrames, F_CHAIN_MAX);
  f.chainEats = 0; f.chainTurbo = 0; f.relockT = 0; f.chainFrames = 0;
  f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6: 新链从零开始(账单/哨兵不能跨链残留)
  f.chainS = dashFrames;
  return true;`]);

/* ---------- ⑨ 6.8 追猎冲刺的出手门限 ---------- */
E.push([`        if (f.circleT <= 0 && f.energy >= PV_.dashMin && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }   // P1: 40px 内无鸟 -> 放弃(隔几帧再采样)
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体`,
`        /* W6(T1) 出手门限: 追猎冲刺只在目标距离 < F_DASH_TRIGGER(280px) 时发起。
         * 判据用"锁定个体当前位置"的距离(没有锁定个体时退化为采样中心距离);
         * 只加在追猎这条路径上, 不改 tryDash 的 60° 结构, 也不拦驱逐冲刺。 */
        const dTrig = (pc && pc.lockIdx >= 0)
          ? Math.hypot(minImageX(P[2 * pc.lockIdx] - f.x), minImageY(P[2 * pc.lockIdx + 1] - f.y))
          : (pc ? Math.hypot(minImageX(pc.cx - f.x), minImageY(pc.cy - f.y)) : 1e9);
        if (f.circleT <= 0 && f.energy >= PV_.dashMin && f.stun <= 0 && pc && dTrig >= F_DASH_TRIGGER) {
          stats.dashTooFar++; f.circleT = 4;      // W6: 太远 -> 不发起, 隔几帧再看(不算落空)
        }
        if (f.circleT <= 0 && f.energy >= PV_.dashMin && f.stun <= 0 && pc && dTrig < F_DASH_TRIGGER) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }   // P1: 40px 内无鸟 -> 放弃(隔几帧再采样)
          else if (tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ)) {   // 第 8 轮修正③: 冲刺瞄锁定个体`]);

/* ---------- ⑩ 链式帧末: 续期上限 / 打断补记 / 计数器 ---------- */
E.push([`    f.x = wrapX(f.x + f.vx);
    f.y = wrapY(f.y + f.vy);`,
`    /* W6(T1) 链式帧末(三条终止条件的收口):
     * ① 每帧把"这一帧确实在冲刺"的吃数同步进 chainEats(雁那一帧已在 6.5 单独累过, 用降序保护);
     * ② dashT 被外部清零(互攻打掉 / applyBoundary 边界收势) -> 补记一次链打断;
     * ③ 能量耗尽(每帧 drain 的 1.5^n 乘子让 drain 超过回能) -> 链收尾, 计 chainEnergyEnds;
     * ④ 续期预算 chainLeft 用尽 -> 链收尾, 计 chainBudgetEnds;
     * ⑤ 能量账单越线(每口一次性记账) -> 链收尾, 计 chainBillEnds;
     * ⑥ chainEats/dashEatsFalcon0/1 供验收算"单次冲刺 eats 均值"。 */
    if (f.chainS > 0) {
      if (f.dashT > 0 && f.chainEats < f.dashEats) f.chainEats = f.dashEats;
      if (f.dashT === 0 && f.chainS > 0) {
        stats.chainInterrupts++;
      }
      if (f.dashT > 0 && f.energy <= 1) { f.dashT = Math.min(f.dashT, 1); stats.chainEnergyEnds++; }
      if (f.dashT > 0 && f.chainLeft <= 0) { f.dashT = Math.min(f.dashT, 1); stats.chainBudgetEnds++; }
      if (f.dashT > 0 && f.chainStop) f.dashT = Math.min(f.dashT, 1);
      f.chainS = f.dashT;
    }
    f.x = wrapX(f.x + f.vx);
    f.y = wrapY(f.y + f.vy);`]);

/* ---------- ⑪ (已并入上面的链式帧尾锚点: 隼①②累计吃数在冲刺收尾处结算) ---------- */

/* ---------- ⑫ stats: dashTooFar / 链终止分账 ---------- */
E.push([`                relockMiss: 0,                   // W6: 再锁定窗口内没找到合格目标而落空的次数`,
`                relockMiss: 0,                   // W6: 再锁定窗口内没找到合格目标而落空的次数
                dashTooFar: 0,                   // W6: 因目标距离 >= F_DASH_TRIGGER 而放弃出手的次数
                chainEnergyEnds: 0,              // W6: 链因能量耗尽(每帧 drain 的 1.5^n)而收尾的次数
                chainBudgetEnds: 0,              // W6: 链因续期预算 chainLeft 用尽而收尾的次数
                chainBillEnds: 0,                // W6: 链因能量账单越线(每口 1.5^n, F_CHAIN_BITES)而收尾的次数`]);

/* ---------- ⑬ 互攻打断: 已吃则免罚 ---------- */
E.push([`      if (lose.dashT > 0) {                          // 被打断的冲刺同样走落空罚款流程
        if (lose.dashEats === 0) {`,
`      if (lose.dashT > 0) {                          // 被打断的冲刺同样走落空罚款流程
        if (lose.dashEats === 0 && (lose.chainEats || 0) === 0) {   // W6(T1): 链上已有斩获 -> 整链免罚`]);

/* ---------- ⑭ 面板 ---------- */
E.push([`    \` · 无目标放弃 \${stats.noLockAborts} · 互攻 \${stats.clashes}（抢分 \${stats.steals}） · ε=\${E0 ? E0.eps.toFixed(2) : "—"}<br>\` +`,
`    \` · 无目标放弃 \${stats.noLockAborts} · 互攻 \${stats.clashes}（抢分 \${stats.steals}） · ε=\${E0 ? E0.eps.toFixed(2) : "—"}<br>\` +
    \`链式攻击(W6): 链 \${stats.chainTriggers} 次 · 单链最多 \${stats.chainMaxEats} 只 · 再锁定 \${stats.chainRelock} · 大餐收尾 \${stats.chainGooseEnds}\` +
    \` · 打断 \${stats.chainInterrupts} · 全空罚款 \${stats.chainFullMissPenalties} · 距离门限 \${stats.dashTooFar}\` +
    \` · 链终止: 能量 \${stats.chainEnergyEnds}/预算 \${stats.chainBudgetEnds}/账单 \${stats.chainBillEnds}\` +
    \` · dashMaxEats \${stats.dashMaxEats}/锁定 \${stats.dashMaxEatsLocked}/自由 \${stats.dashMaxEatsFree}<br>\` +`]);

/* ---------- ⑮ SIM 钩子 ---------- */
E.push([`  get samplingConst() { return { radii: SAMPLE_RADII.slice(), angles: SAMPLE_ANGLES, SCOOP_R, LOCK_R, DIR_LAG }; },`,
`  get samplingConst() { return { radii: SAMPLE_RADII.slice(), angles: SAMPLE_ANGLES, SCOOP_R, LOCK_R, DIR_LAG }; },
  // W6(T1): 链式攻击常量与实时状态(验收/面板共用)
  get chainConst() { return { R: F_CHAIN_R, CONE_DEG: 45, RELOCK: F_CHAIN_RELOCK, MAX: F_CHAIN_MAX, TRIGGER: F_DASH_TRIGGER, FEAST_RECOVER: F_FEAST_RECOVER, HOME_K: DASH_HOME_K, BITES: F_CHAIN_BITES }; },
  get chainInfo() {
    return falcons.map((f, k) => ({ id: k, chainEats: f.chainEats, chainLeft: f.chainLeft,
      chainTurbo: f.chainTurbo, chainBill: f.chainBill, lockIdx: f.lockIdx, dashT: f.dashT, dashEats: f.dashEats, dashS: f.dashS,
      eats: k === 0 ? stats.dashEatsFalcon0 : stats.dashEatsFalcon1,
      dashEnds: k === 0 ? stats.dashEndsFalcon0 : stats.dashEndsFalcon1 }));
  },`]);

E.push([`             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,`,
`             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,
             chainEats: h.chainEats || 0, chainLeft: h.chainLeft || 0, chainS: h.chainS || 0,   // W6`]);

/* ---------- ⑯ 重置 ---------- */
E.push([`    f.dashEats = 0; f.lockIdx = -1; f.mob = 0; f.stun = 0; f.clashCd = 0;`,
`    f.dashEats = 0; f.lockIdx = -1; f.mob = 0; f.stun = 0; f.clashCd = 0;
    f.chainLeft = 0; f.chainEats = 0; f.relockT = 0; f.chainTurbo = 0; f.chainS = 0; f.chainFrames = 0;
    f.chainEatsPrev = 0; f.chainBill = 0; f.chainStop = 0;   // W6`]);

/* ---------- ⑰ resetStats ---------- */
E.push([`  for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }
  for (const E of eagles) { E.score = 0; E.kills = 0; E.dashEats = 0; E.dietStarling = 0; E.dietGoose = 0; }`,
`  for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }
  for (const E of eagles) { E.score = 0; E.kills = 0; E.dashEats = 0; E.dietStarling = 0; E.dietGoose = 0; }
  // W6(T1): 链式攻击计数(与 resetFlocks 无关, 但和分数一起归零才自洽)
  stats.chainTriggers = 0; stats.chainGooseEnds = 0; stats.chainRelock = 0; stats.chainMaxEats = 0;
  stats.dashEatsFalcon0 = 0; stats.dashEatsFalcon1 = 0; stats.chainInterrupts = 0;
  stats.dashEndsFalcon0 = 0; stats.dashEndsFalcon1 = 0;
  stats.chainFullMissPenalties = 0; stats.relockMiss = 0; stats.dashTooFar = 0;
  stats.chainEnergyEnds = 0; stats.chainBudgetEnds = 0; stats.chainBillEnds = 0;`]);

/* ---------- ⑱ 鲸: chainRelockPick 辅助函数 ---------- */
E.push([`// tryDash: 发起冲刺。带 ±60° 方向约束 —— 目标必须在当前航向 60° 以内,`,
`/* W6(T1) 动态再锁定的目标选择: 当前航向 F_CHAIN_CONE(45°) 锥内 + r2 半径内最近的活椋鸟。
 * 为什么只看椋鸟: 链式扫射追的是"下一口"; 雁的进入由 6.5 的大餐收尾单独处理,
 * 猛禽互攻走 6.9, 都不该被这里当作"下一口"去追(否则链会拐去撞鹰)。 */
function chainRelockPick(f, r2) {
  const sp = Math.hypot(f.vx, f.vy);
  if (sp <= 1e-9) return -1;
  const ux = f.vx / sp, uy = f.vy / sp;
  let best = -1, bestD = r2;
  // 复用 perceive 的视野缓冲 VIS/nVis 不现实(会覆盖), 这里直接扫桶网格视图内的鸟
  const cellR = Math.sqrt(r2) + CELL * 0.75, cellR2 = cellR * cellR;
  for (let oi = 0; oi < cellOrderN; oi++) {
    const c = cellOrder[oi];
    const cx = c % GW, cy = (c / GW) | 0;
    const bx = -PAD + (cx + 0.5) * CELL, by = -PAD + (cy + 0.5) * CELL;
    const dxc = minImageX(bx - f.x), dyc = minImageY(by - f.y);
    if (dxc * dxc + dyc * dyc > cellR2) continue;
    for (let j = gridHead[c]; j !== -1; j = gridNext[j]) {
      if (!alive[j]) continue;
      const ex = minImageX(P[2 * j] - f.x), ey = minImageY(P[2 * j + 1] - f.y);
      const d2 = ex * ex + ey * ey;
      if (d2 > bestD || d2 <= 1e-9) continue;
      const dn = Math.sqrt(d2);
      if ((ex * ux + ey * uy) / dn < F_CHAIN_COS) continue;   // 45° 锥内
      bestD = d2; best = j;
    }
  }
  return best;
}

// tryDash: 发起冲刺。带 ±60° 方向约束 —— 目标必须在当前航向 60° 以内,`]);

/* ---------- 执行 ---------- */
let src = fs.readFileSync(HTML, "utf8");
const APPLY = process.argv.includes("--apply");
let applied = 0, skipped = 0, missed = [];
for (const [from, to] of E) {
  const n = src.split(from).length - 1;
  if (n === 0) {
    if (src.includes(to.split("\n").slice(0, 3).join("\n"))) { skipped++; console.log("已应用(跳过):", JSON.stringify(from.slice(0, 46))); }
    else missed.push(from.slice(0, 80));
    continue;
  }
  if (n > 1) { missed.push("AMBIGUOUS(" + n + "): " + from.slice(0, 80)); continue; }
  src = src.replace(from, to);
  applied++;
}
console.log("applied=" + applied + " skipped=" + skipped + " missed=" + missed.length);
if (missed.length) { console.log("MISSED:"); for (const m of missed) console.log("  - " + m); }
if (APPLY && missed.length === 0) {
  fs.writeFileSync(HTML, src);
  console.log("WROTE", HTML, src.length, "bytes");
} else if (APPLY) {
  console.log("有未命中的锚点, 不写回");
  process.exit(2);
}
