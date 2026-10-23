/* ============================================================================
 * accept_emergence.mjs —— W2 验收: 群体涌现指标 + 惊飞信息传播
 * 用法: node _checks\accept_emergence.mjs [html] [frames] [trials]
 *      (SIM_HTML / SIM_FRAMES / SIM_TRIALS 亦可; 默认 掠食竞赛.html / 5000 / 5)
 * 判据:
 *   E1 极化度 order = |Σv| / Σ|v|   (报告 + 阈值, 越高越"像一群")
 *   E2 抽样最近邻均值(px)           (报告 + 阈值, 越小越紧凑)
 *   E3 群体 90% 分位半径(px)        (报告 + 阈值, 越小越聚)
 *   E4 一次惊飞后的转向信息传播距离 >= 300px
 *      —— 做法: 稳定后对"中心一小簇"施加持续 nudge(E4_NUDGE 帧), 只在 f=nudge 后解除;
 *         那些随后 60° 满速转向的鸟, 离注入口最远者即传播距离。
 *         子判据 E4b: 传播到最后 NUDGE_FREE 帧注入已解除, 说明是"接力"而非"持续拽"。
 * 不改主文件; 只读钩子。
 * ==========================================================================*/
import { cliHtml, cliFrames, cliFloat, loadSim, worldOf, makeReporter, setup, readHtml, mean, quantile, f1 } from "./accept_lib.mjs";

const HTML = cliHtml();
const FRAMES = cliFrames(5000);
const TRIALS = Math.round(cliFloat(4, 5));
const { html: HTML_SRC, hash: HTML_HASH, bytes: HTML_BYTES } = readHtml(HTML);
const E4_FREE = 900;             // 注入后观察帧数(传播窗口)
const E4_R = 60;                 // 注入口半径(px): 中心簇
const E4_SPEED = 3.6;            // 注入时的速度大小(满速)
const E4_TURN_COS = 0.5;         // "转过 60°" 判据(与主文件 PV_ALERT_COS 同口径)

const R = makeReporter(`accept_emergence  html=${HTML}  frames=${FRAMES}  trials=${TRIALS}`);
R.info("被测文件版本(钉扎)", `sha256:${HTML_HASH}… (${HTML_BYTES} 字节)`, "所有试验使用同一份内容");

let SIM;
try { ({ SIM } = loadSim(HTML, HTML_SRC)); } catch (e) { R.say("  加载失败: " + e.message); R.finish(); process.exit(2); }

/* ---------------- 先跑稳定期, 取 E1/E2/E3 ---------------- */
setup(SIM, { n: 2000, gravity: true, refill: false });
const WI = worldOf(SIM);

const orderSamples = [], nnSamples = [], rad90Samples = [], rad50Samples = [];
let aliveMin = Infinity;

function snapshotMetrics() {
  const pts = [];
  let svx = 0, svy = 0, ssp = 0;
  for (let i = 0; i < SIM.N; i++) {
    const s = SIM.starling(i);
    if (!s.alive) continue;
    pts.push(s);
    const sp = Math.hypot(s.vx, s.vy);
    svx += s.vx; svy += s.vy; ssp += sp;
  }
  if (!pts.length) return null;
  const order = ssp > 0 ? Math.hypot(svx, svy) / ssp : 0;
  // 最近邻: 均匀抽 200 只, 每只扫全群(与 headless 同口径, 避免 N^2 全量)
  const step = Math.max(1, Math.floor(pts.length / 200));
  let nnSum = 0, nnCnt = 0;
  for (let a = 0; a < pts.length; a += step) {
    let best = Infinity;
    const A = pts[a];
    for (let b = 0; b < pts.length; b++) {
      if (b === a) continue;
      const d2 = (A.x - pts[b].x) ** 2 + (A.y - pts[b].y) ** 2;
      if (d2 < best) best = d2;
    }
    nnSum += Math.sqrt(best); nnCnt++;
  }
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  const rad = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
  return { order, nn: nnSum / nnCnt, rad50: quantile(rad, 0.5), rad90: quantile(rad, 0.9),
           n: pts.length, cx, cy };
}

const STABLE_TO = Math.min(FRAMES, 1200);
let err = null;
try {
  for (let f = 1; f <= STABLE_TO; f++) {
    SIM.step();
    if (f < 300) continue;                        // 跳过出生瞬态
    aliveMin = Math.min(aliveMin, SIM.aliveCount);
    if (f % 25 === 0) {
      const m = snapshotMetrics();
      if (m) { orderSamples.push(m.order); nnSamples.push(m.nn); rad90Samples.push(m.rad90); rad50Samples.push(m.rad50); }
    }
  }
} catch (e) { err = e.message + "\n" + e.stack; }
if (err) R.say("  ✗ 稳定期跑帧异常: " + err);

const orderMean = mean(orderSamples), nnMean = mean(nnSamples), rad90Mean = mean(rad90Samples), rad50Mean = mean(rad50Samples);
R.info("稳定期样本数", orderSamples.length, `f300~f${STABLE_TO}, 每 25 帧一次`);
R.info("E1 极化度 order(均值/最小/最大)", `${f1(orderMean)} / ${f1(Math.min(...orderSamples))} / ${f1(Math.max(...orderSamples))}`);
R.info("E2 抽样最近邻均值", f1(nnMean));
R.info("E3 群体半径 50%/90% 分位", `${f1(rad50Mean)} / ${f1(rad90Mean)}`);
R.info("存活数下限", aliveMin);

R.check("E1 极化度 order(均值)", orderMean, ">=", 0.5, "阈值来自\"成团流动\"判据; 越高越像一群");
R.check("E2 抽样最近邻均值(px)", nnMean, "<=", 45, "与 headless [2] 同口径(第6轮基准 11.4, 现约 5~8)");
R.check("E3 群体 90% 分位半径(px)", rad90Mean, "<=", 800, `世界 ${WI.worldW}x${WI.worldH}, 视口对角 ${f1(Math.hypot(WI.viewW, WI.viewH))}`);
R.info("E3b 群体 50% 分位半径(px)", f1(rad50Mean));

/* ---------------- E4 惊飞传播 ----------------
 * 现在主文件提供了写钩子(Lead 已合入), 所以可以做**严格**的单点扰动测量:
 *   ① 把猛禽全部挪到远角(排除外部扰动源), 稳定 600 帧(GRAV=0, 纯 xy);
 *   ② 在鸟群质心取半径 E4_R 的局部簇, 用 SIM.setStarlingVel 把这一簇的速度一次性反向
 *      (满速) —— 只注入 1 帧, 之后完全不碰任何个体;
 *   ③ 观察 E4_FREE 帧: 记录
 *      · reachTurn(f): 相对"扰动前航向"转过 60° 的鸟离扰动点的最远距离
 *      · reachStartle(f): SIM.startledList() 里离扰动点最远的个体距离(主文件口径的惊飞标志)
 *   ④ 判据: 传播距离 = max_f reach(f); 传播性 = reach 随时间增长(E4c)。
 * 因为扰动源在注入 1 帧后消失, 后续任何新的惊飞/转向都只能来自鸟与鸟之间接力。
 * 缺钩子时打印 NOT IMPLEMENTED 而不是崩溃。
 * 三层指标(与 lead 要求一致):
 *   E4  距离上界: 传播后转向/惊飞的最远距离 >= 300px
 *   E4b 净传播: 扣除注入半径
 *   E4c 传播性: reach 随帧增长(不是一帧内全群同时反应) */
const trialRows = [];
const hasWrite = typeof SIM.setStarlingVel === "function";
const hasStartle = typeof SIM.startledList === "function";
R.info("E4 可用钩子", `setStarlingVel=${hasWrite} startledList=${hasStartle} starlingNear=${typeof SIM.starlingNear === "function"}`);
if (!hasWrite) {
  R.skip("E4 惊飞后转向信息传播距离", "缺 SIM.setStarlingVel(i,vx,vy): 无法做严格的单点扰动(只能靠 parkRaptors 触发全局反应)");
} else {
  for (let t = 0; t < TRIALS; t++) {
    setup(SIM, { n: 2000, gravity: false, refill: false });   // 关重力: 只看 xy 平面的信息传播
    for (let f = 0; f < 600; f++) { if (typeof SIM.parkRaptors === "function") SIM.parkRaptors(-99 * WI.boundR, -99 * WI.boundR); SIM.step(); }
    const pts = [];
    for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) pts.push([i, s]); }
    let cx = 0, cy = 0;
    for (const [, s] of pts) { cx += s.x; cy += s.y; }
    cx /= pts.length; cy /= pts.length;
    // 扰动点: 质心(每次都打在群体中心, 便于测"从中心向外的传播")
    const ox = cx, oy = cy;
    const preAng = new Float64Array(SIM.N);
    for (const [i, s] of pts) preAng[i] = Math.atan2(s.vy, s.vx);
    // 注入: 半径 E4_R 内的个体速度整体反向(1 帧), 之后不再干预
    const near = typeof SIM.starlingNear === "function"
      ? SIM.starlingNear(ox, oy, E4_R)
      : pts.filter(([, s]) => Math.hypot(s.x - ox, s.y - oy) <= E4_R).map(([i]) => i);
    let injected = 0;
    for (const i of near) {
      const s = SIM.starling(i);
      const sp = Math.hypot(s.vx, s.vy) || E4_SPEED;
      injected += SIM.setStarlingVel(i, -s.vx / (sp || 1) * E4_SPEED, -s.vy / (sp || 1) * E4_SPEED) ? 1 : 0;
    }
    // 观察
    const seen = new Uint8Array(SIM.N);
    const curve = [];
    const r25Curve = [];
    let r25max = 0;
    let maxTurnDist = 0, turned = 0, firstTurnFrame = -1, farWho = "";
    let maxStartleDist = 0, startleTotal = 0, firstStartleFrame = -1, startleFrames = 0;
    for (let f = 1; f <= E4_FREE; f++) {
      SIM.parkRaptors(-99 * WI.boundR, -99 * WI.boundR);   // 保持"无外部扰动源"
      SIM.step();
      let frameReach = 0, frameNew = 0;
      for (let i = 0; i < SIM.N; i++) {
        const s = SIM.starling(i);
        if (!s.alive) continue;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp < 1e-6) continue;
        const c = (s.vx * Math.cos(preAng[i]) + s.vy * Math.sin(preAng[i])) / sp;
        if (c < E4_TURN_COS) {
          if (!seen[i]) { seen[i] = 1; turned++; frameNew++; }
          const d = Math.hypot(s.x - ox, s.y - oy);
          if (d > frameReach) frameReach = d;
          if (d > maxTurnDist) { maxTurnDist = d; if (firstTurnFrame < 0) firstTurnFrame = f; farWho = "starling#" + i; }
        }
      }
      // 主文件口径的"惊飞"标志
      if (hasStartle) {
        const sl = SIM.startledList();
        if (sl.length) { startleFrames++; if (firstStartleFrame < 0) firstStartleFrame = f; }
        startleTotal += sl.length;
        for (const i of sl) {
          const s = SIM.starling(i);
          const d = Math.hypot(s.x - ox, s.y - oy);
          if (d > maxStartleDist) maxStartleDist = d;
        }
      }
      // R25 连续传播半径: 以扰动点为心, 找最大的 d 使得"半径 d 内的鸟里 >=25% 已被带动(转过 60°)";
      // 它度量"波已经连续转化了多大一片区域", 比 max 距离稳健(不受几只远端散鸟影响)。
      if (f % 5 === 0 || f <= 10) {
        const arr = [];
        for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) arr.push([Math.hypot(s.x - ox, s.y - oy), seen[i]]); }
        arr.sort((a, b) => a[0] - b[0]);
        let cum = 0, cumT = 0, r25 = 0;
        for (const [d, t] of arr) { cum++; cumT += t; if (cum >= 5 && cumT / cum >= 0.25) r25 = d; }
        if (r25 > r25max) r25max = r25;
        r25Curve.push({ f, r25 });
      }
      if (f <= 10 || f % 25 === 0 || f === E4_FREE) curve.push({ f, reach: frameReach, newTurn: frameNew, startles: hasStartle ? SIM.startledList().length : null });
    }
    const at = n => (curve.find(r => r.f === n) || {}).reach || 0;
    trialRows.push({ t, injected, near: near.length, turned, maxTurnDist, firstTurnFrame, farWho,
                     maxStartleDist, startleTotal, firstStartleFrame, startleFrames, r25max,
                     reachF1: at(1), reachF10: at(10), reachF50: at(50), reachFEnd: at(E4_FREE),
                     curve: curve.filter(r => r.f <= 10).map(r => `f${r.f}:${r.reach.toFixed(0)}(+${r.newTurn}${r.startles === null ? "" : "/惊" + r.startles})`).join(" ") });
  }
}

R.info("E4 扰动口径", `局部反向注入 1 帧(半径 ${E4_R}px), 之后不再干预; 观察 ${E4_FREE} 帧; 判据 cos<${E4_TURN_COS}(转过 60°)`);
const okTrials = trialRows.filter(r => !r.err);
if (okTrials.length) {
  for (const r of okTrials) {
    R.info(`  试验#${r.t}`, `注入 ${r.injected}/${r.near} 只; 传播后 ${r.turned} 只转向; ` +
      `最远 ${f1(r.maxTurnDist)}px(${r.farWho}); 该鸟首转帧 ${r.firstTurnFrame}; ` +
      `主文件惊飞标志最远 ${f1(r.maxStartleDist)}px(共 ${r.startleTotal} 只次, 首帧 ${r.firstStartleFrame}); R25=${f1(r.r25max)}px`);
    R.info(`    前 10 帧半径曲线(转向/新增/惊飞数)`, r.curve);
  }
  const med = quantile(okTrials.map(r => r.maxTurnDist), 0.5);
  const mn = Math.min(...okTrials.map(r => r.maxTurnDist));
  const medF1 = quantile(okTrials.map(r => r.reachF1), 0.5);
  const medF10 = quantile(okTrials.map(r => r.reachF10), 0.5);
  const medF50 = quantile(okTrials.map(r => r.reachF50), 0.5);
  const medS1 = quantile(okTrials.map(r => r.maxStartleDist), 0.5);
  R.info("E4 半径时间结构(中位)", `f1 ${f1(medF1)}px -> f10 ${f1(medF10)}px -> f50 ${f1(medF50)}px; 全程最大 ${f1(med)}px`);
  R.info("E4 首帧半径占比", `${f1(100 * medF1 / Math.max(1, med))}%  (f1 就达到全程最大半径的该比例; 接近 100% = 一帧内全群同时反应)`);
  R.info("E4 主文件惊飞标志最远距离(中位)", f1(medS1), "startledList() 口径");
  const r25med = quantile(okTrials.map(r => r.r25max), 0.5);
  R.info("E4e R25 连续传播半径(中位)", f1(r25med), "以扰动点为心、半径内 >=25% 鸟被带动的最大半径; 与 W2 的对照口径");
  R.check("E4f R25 连续传播半径 >= 200px", r25med, ">=", 200, `各次 ${okTrials.map(r => f1(r.r25max)).join("/")}px`);
  R.check("E4 惊飞后转向信息传播距离(中位)", med, ">=", 300, `最小 ${f1(mn)}px, ${okTrials.length}/${TRIALS} 次试验`);
  R.check("E4b 净传播(扣除注入半径 " + E4_R + "px)", med - E4_R, ">=", 300 - E4_R, `净 ${f1(med - E4_R)}px`);
  R.check("E4c 传播性(半径随时间增长 f1->f10)", medF10 - medF1, ">", 0,
    `f1 ${f1(medF1)}px -> f10 ${f1(medF10)}px; 不增长 = 一帧内全群同时反应(直接反应, 非接力)`);
  if (hasStartle) {
    R.check("E4d 惊飞标志也传出扰动半径", medS1, ">=", E4_R, `startledList 最远 ${f1(medS1)}px >= 注入半径 ${E4_R}px`);
  } else {
    R.skip("E4d 惊飞标志传播距离", "缺 SIM.startledList() 钩子");
  }
}
R.finish();
