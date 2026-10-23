/* ============================================================================
 * W2 涌现探针: 用同一份脚本对任意 html 量出 4 个"鸟群涌现"指标
 * ----------------------------------------------------------------------------
 * 用法: node _checks/emergence_probe.mjs [html路径] [标签]
 *       默认 html路径 = ../掠食竞赛.html, 标签 = 文件名
 *       环境变量: W2_WARM(预热帧,1200) W2_CRUISE(巡航采样窗口,400)
 *                 W2_WAVE(惊飞波窗口,150) W2_SEEDS(重复种子数,1) W2_FAST=1 -> 600/200/120
 *
 * 四个指标(全部在 N=2000、猛禽被 park 到角落=无干扰 的条件下测):
 *  (a) 极化度 order = |Σ v_i/|v_i|| / N (巡航期逐帧平均; 另给最小值)
 *      刚性对照: 巡航期"群体平均航向"累计转角(太小=僵硬), 以及下面的惊飞波。
 *  (b) 抽样最近邻平均距离(px) —— 期望 5~10px
 *  (c) 群体 90% 分位半径 R90: 均值 / 相对波动 CV(呼吸感) / 首尾三分位趋势(膨胀或塌缩)
 *  (d) 惊飞波: 把猛禽瞬移到"离质心最远的鸟"身上一帧(走真实 flee 受力)制造惊飞。
 *      判定用**同种子双沙箱锁步对照**: A 惊飞 / B 不惊飞, t0 前逐位一致,
 *      之后逐帧比较**同一只鸟**在两份跑里的航向夹角 > 45° 记为被带动;
 *      整体旋转与自发漂移在 A-B 相减中抵消(单跑口径约 9% 假阳性)。
 *      传播距离 = 被带动个体里离触发点最远的初始距离, 并给 30/60/90/150 帧的波前半径。
 *
 * 说明: 该脚本只读 html、不写任何文件; 一切经 window.SIM 公开接口取数。
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const htmlPath = path.resolve(ROOT, process.argv[2] || "掠食竞赛.html");
const label = process.argv[3] || path.basename(htmlPath);

const FAST = process.env.W2_FAST === "1";
const WARM = Number(process.env.W2_WARM || (FAST ? 600 : 1200));
const CRUISE = Number(process.env.W2_CRUISE || (FAST ? 200 : 400));
const SAMPLE_EVERY = 10;
const WAVE = Number(process.env.W2_WAVE || (FAST ? 120 : 150));
const NTRIAL = Number(process.env.W2_TRIAL || (FAST ? 2 : 3));   // 触发次数(取平均, 单只触发鸟几何差异太大)
const RECOVER = Number(process.env.W2_RECOVER || 220);           // 两次触发之间的恢复帧数
const INJECT_R = Number(process.env.W2_INJECT_R || 60);          // 惊飞注入半径(px)
const SEEDS = Math.max(1, Number(process.env.W2_SEEDS || 1));
const WAVE_DEG = 45;
const R2D = 180 / Math.PI;

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const degDiff = (ax, ay, bx, by) => {
  const s0 = Math.hypot(ax, ay), s1 = Math.hypot(bx, by);
  if (s0 < 1e-9 || s1 < 1e-9) return 0;
  let cos = (ax * bx + ay * by) / (s0 * s1);
  if (cos > 1) cos = 1; else if (cos < -1) cos = -1;
  return Math.acos(cos) * R2D;
};

function buildSim(seed) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const cut = html.indexOf('<script type="text/plain"');
  const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join("\n;\n");
  const grad = { addColorStop() {} };
  const gctx = new Proxy({}, { get: (t, p) => (p in t ? t[p]
      : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad
      : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "",
    children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => gctx,
    appendChild(c) { if (c && c.id) els.set(c.id, c); return c; }, removeChild(c) { return c; },
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
  const doc = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
                addEventListener() {}, createElement: () => mk("c") };
  const SM = Object.create(Math);                     // 种子化随机数: 两份沙箱必须逐位可复现
  let s = seed >>> 0;
  SM.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sb = { document: doc, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } },
               Math: SM, location: { search: "" }, navigator: {},
               performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
               requestAnimationFrame: () => 0, console };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: "sim.js" });
  return sb.window.SIM;
}

const liveBirds = SIM => {
  const out = [];
  for (let i = 0; i < SIM.N; i++) { const b = SIM.starling(i); if (b.alive) out.push(b); }
  return out;
};

/* ---- 单次测量: 返回 4 个指标 ---- */
function measure(seed) {
  const SIM_A = buildSim(seed), SIM_B = buildSim(seed);
  for (const S of [SIM_A, SIM_B]) { S.setGeometry(false); S.setN(2000); S.setRefill(false); }
  // 世界尺寸(Lead 的 W1 之后世界与视窗解耦): 只在"离边界 >600px"的窗口里统计涌现,
  // 否则边界厌恶力造成的整体转向会污染极化度/惊飞波读数。
  const wi = SIM_A.worldInfo ? SIM_A.worldInfo() : null;
  const WW = wi ? wi.worldW : Infinity, HH = wi ? wi.worldH : Infinity;
  const NEAR = 600;
  const farFromEdge = (x, y) => (x > NEAR && x < WW - NEAR && y > NEAR && y < HH - NEAR);
  let skippedEdge = 0;

  /* 预热 + 巡航: A/B 锁步推进(此刻两者逐位相同), 指标只在 A 上采样 */
  const tWarm = process.hrtime.bigint();
  for (let f = 0; f < WARM; f++) { SIM_A.parkRaptors(); SIM_B.parkRaptors(); SIM_A.step(); SIM_B.step(); }
  const warmMs = Number(process.hrtime.bigint() - tWarm) / 1e6 / WARM;

  let sumOrder = 0, minOrder = 1, nOrd = 0;
  let sumNN = 0, minNN = 1e9, maxNN = 0, nNN = 0;
  const r90s = [];
  let sumTurn = 0, prevDir = null, sumSpeed = 0;
  /* 逐帧"航向变化率"直方图(rad/帧): 给"惊飞波源"阈值定标 —— 阈值必须高于正常巡航抖动
   * (分离力尖峰也能让鸟一帧转几度), 又低于被猛禽吓到时的急转。 */
  const TBINS = 24, TH = 0.6, histTurn = new Int32Array(TBINS + 1), histTurnFast = new Int32Array(TBINS + 1);
  const cvx = new Float64Array(SIM_A.N), cvy = new Float64Array(SIM_A.N);
  let havePrev = false;
  for (let f = 0; f < CRUISE; f++) {
    SIM_A.parkRaptors(); SIM_B.parkRaptors(); SIM_A.step(); SIM_B.step();
    for (let i = 0; i < SIM_A.N; i++) {
      const b = SIM_A.starling(i);
      if (!b.alive) { cvx[i] = 0; cvy[i] = 0; continue; }
      if (havePrev) {
        const s0 = Math.hypot(cvx[i], cvy[i]), s1 = Math.hypot(b.vx, b.vy);
        if (s0 > 1e-6 && s1 > 1e-6) {
          let cs = (cvx[i] * b.vx + cvy[i] * b.vy) / (s0 * s1);
          if (cs > 1) cs = 1; else if (cs < -1) cs = -1;
          const bin = Math.min(TBINS, Math.floor(Math.acos(cs) / TH * TBINS));
          histTurn[bin]++;
          // 只有"两帧都在全速"的急转才算数: 慢速鸟的航向是噪声(实测全速外 P99.9 能到 13°/帧)
          if (s0 > 0.75 * SIM_A.maxSpeed && s1 > 0.75 * SIM_A.maxSpeed) histTurnFast[bin]++;
        }
      }
      cvx[i] = b.vx; cvy[i] = b.vy;
    }
    havePrev = true;
    if (f % SAMPLE_EVERY !== 0) continue;
    const alive = liveBirds(SIM_A);
    const n = alive.length;
    let ux = 0, uy = 0, spSum = 0, cx = 0, cy = 0;
    for (const b of alive) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1e-9) { ux += b.vx / sp; uy += b.vy / sp; }
      spSum += sp; cx += b.x; cy += b.y;
    }
    cx /= n; cy /= n;
    if (!farFromEdge(cx, cy)) { skippedEdge++; prevDir = null; continue; }
    const order = Math.hypot(ux, uy) / Math.max(1, n);
    sumOrder += order; if (order < minOrder) minOrder = order; nOrd++;
    sumSpeed += spSum / n;
    const dir = Math.atan2(uy, ux);
    if (prevDir !== null) sumTurn += Math.abs(angDiff(dir, prevDir));
    prevDir = dir;
    const stride = Math.max(1, Math.floor(alive.length / 250));      // 抽样最近邻
    let sNN = 0, cNN = 0;
    for (let i = 0; i < alive.length; i += stride) {
      const a = alive[i];
      let best = 1e9;
      for (let j = 0; j < alive.length; j++) {
        if (j === i) continue;
        const dx = alive[j].x - a.x, dy = alive[j].y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1e-12 && d2 < best) best = d2;
      }
      sNN += Math.sqrt(best); cNN++;
    }
    const nn = sNN / Math.max(1, cNN);
    sumNN += nn; if (nn < minNN) minNN = nn; if (nn > maxNN) maxNN = nn; nNN++;
    const ds = alive.map(b => Math.hypot(b.x - cx, b.y - cy)).sort((x, y) => x - y);
    r90s.push(ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.9))]);
  }
  if (nOrd === 0) throw new Error("所有巡航采样点都落在边界 600px 内: 请加长预热/巡航窗口");
  const turnPct = (hist, p) => {                             // 由直方图反查分位数(rad/帧 -> 度/帧)
    let tot = 0; for (const v of hist) tot += v;
    const want = tot * p; let acc = 0;
    for (let k = 0; k <= TBINS; k++) { acc += hist[k]; if (acc >= want) return (k + 0.5) * TH / TBINS * R2D; }
    return TH * R2D;
  };
  const rMean = r90s.reduce((a, b) => a + b, 0) / r90s.length;
  const rVar = r90s.reduce((a, b) => a + (b - rMean) ** 2, 0) / r90s.length;
  const third = Math.max(1, Math.floor(r90s.length / 3));
  const rFirst = r90s.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const rLast = r90s.slice(-third).reduce((a, b) => a + b, 0) / third;

  /* ---- 惊飞波: t0 快照(A/B 此刻应逐位一致) ---- */
  const N = SIM_A.N;
  const p0x = new Float64Array(N), p0y = new Float64Array(N);
  const live0 = new Uint8Array(N);
  let cx0 = 0, cy0 = 0, n0 = 0, t0Diff = 0;
  for (let i = 0; i < N; i++) {
    const a = SIM_A.starling(i), b = SIM_B.starling(i);
    live0[i] = a.alive ? 1 : 0;
    p0x[i] = a.x; p0y[i] = a.y;
    t0Diff = Math.max(t0Diff, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    if (a.alive) { cx0 += a.x; cy0 += a.y; n0++; }
  }
  cx0 /= n0; cy0 /= n0;
  /* 触发鸟候选: "稠密区边缘"里 110px 邻居最多的几只 ——
   * 为什么不用"离质心最远的一只": 那常常是掉队的散鸟, 猛禽瞬移过去只吓到它自己(实测偏转 0°)。
   * 为什么要多只取平均: 单只触发鸟的局部几何差异极大(R25 在 150~250px 之间跳), 单次读数不可复现。 */
  const dAll = [];
  for (let i = 0; i < N; i++) if (live0[i]) dAll.push(Math.hypot(p0x[i] - cx0, p0y[i] - cy0));
  dAll.sort((a, b) => a - b);
  const dCut = dAll[Math.min(dAll.length - 1, Math.floor(dAll.length * 0.9))];
  const cand = [];
  for (let i = 0; i < N; i++) {
    if (!live0[i]) continue;
    const d = Math.hypot(p0x[i] - cx0, p0y[i] - cy0);
    if (d < 0.55 * dCut || d > dCut) continue;
    let cnt = 0;
    for (let j = 0; j < N; j++) {
      if (j === i || !live0[j]) continue;
      const dx = p0x[j] - p0x[i], dy = p0y[j] - p0y[i];
      if (dx * dx + dy * dy < 110 * 110) cnt++;
    }
    cand.push({ i, x: p0x[i], y: p0y[i], d, cnt });
  }
  cand.sort((a, b) => b.cnt - a.cnt || b.d - a.d);
  const trigs = [];
  for (const c of cand) {
    if (trigs.length >= NTRIAL) break;
    if (trigs.every(t => Math.hypot(t.x - c.x, t.y - c.y) > 150)) trigs.push(c);
  }
  if (!trigs.length) throw new Error("找不到触发鸟候选");
  const SP_MIN = 0.75 * SIM_A.maxSpeed;             // 慢速诊断线(不用于剔除)
  const DEV_TH = SP_MIN;                            // 判据线: |vA-vB| > 0.75·MAX_SPEED(≈全速下 45° 转向)

  /* 逐次触发: A 惊飞 / B 对照(锁步), 每次之间留恢复期 */
  const trials = [];
  const dbgList = [];
  for (let t = 0; t < trigs.length; t++) {
    // 触发前快照
    const px0 = new Float64Array(N), py0 = new Float64Array(N), live = new Uint8Array(N);
    let tri = trigs[t].i;
    if (!SIM_A.starling(tri).alive) { const alt = trigs.find(q => SIM_A.starling(q.i).alive); if (!alt) break; tri = alt.i; }
    const tx = SIM_A.starling(tri).x, ty = SIM_A.starling(tri).y;
    for (let i = 0; i < N; i++) { const a = SIM_A.starling(i); live[i] = a.alive ? 1 : 0; px0[i] = a.x; py0[i] = a.y; }
    const edgeGap = Math.min(tx, ty, WW - tx, HH - ty);
    /* 惊飞注入: 触发点 60px 内的鸟速度反向(180°), **只干预这一帧**, 之后两份跑都不再干预。
     * 为什么不用"把猛禽瞬移到触发点": 猛禽进了鸟群 -> 它的 AI/吃鸟/随机数消耗与对照跑不同,
     * 整条随机数流会错位, 于是全群在几十帧内整体发散(实测无接力机制时也报 50% 被带动) ——
     * 那是"随机流错位"而不是传播。setStarlingVel 注入不碰猛禽, 两份跑的随机数流保持一致。 */
    let injected = 0;
    if (SIM_A.setStarlingVel) {
      for (let i = 0; i < N; i++) {
        if (!live[i]) continue;
        if (Math.hypot(px0[i] - tx, py0[i] - ty) > INJECT_R) continue;
        const a = SIM_A.starling(i);
        if (SIM_A.setStarlingVel(i, -a.vx, -a.vy)) injected++;
      }
      SIM_B.parkRaptors(); SIM_A.parkRaptors();
    } else {
      SIM_A.parkRaptors(tx, ty);                              // 旧版回退: 猛禽瞬移到触发点
      SIM_B.parkRaptors();
    }
    SIM_A.step(); SIM_B.step();
    const maxDev = new Float64Array(N), firstDev = new Float64Array(N).fill(-1), minSp = new Float64Array(N).fill(1e9);
    for (let i = 0; i < N; i++) { if (!live[i]) continue; const a = SIM_A.starling(i); minSp[i] = Math.hypot(a.vx, a.vy); }
    for (let f = 1; f <= WAVE; f++) {
      SIM_A.parkRaptors(); SIM_B.parkRaptors();
      SIM_A.step(); SIM_B.step();
      for (let i = 0; i < N; i++) {
        if (!live[i]) continue;
        const a = SIM_A.starling(i), b = SIM_B.starling(i);
        if (!a.alive || !b.alive) continue;
        const sa = Math.hypot(a.vx, a.vy);
        if (sa < minSp[i]) minSp[i] = sa;
        // 判据用"两份跑同一只鸟的速度矢量差"|vA-vB| 而不是航向夹角:
        // 慢速鸟(被顶到失速)的航向是噪声, 矢量差天然把这种噪声压掉, 又对真正的转向/失速都敏感。
        const dv = Math.hypot(a.vx - b.vx, a.vy - b.vy);
        if (dv > maxDev[i]) maxDev[i] = dv;
        if (firstDev[i] < 0 && dv > DEV_TH) firstDev[i] = f;
      }
    }
    let nAff = 0, maxDist = 0, nearTurn = 0, nearCnt = 0, slowCnt = 0, strayCnt = 0;
    const at = { 30: 0, 60: 0, 90: 0, 150: 0 };
    const bins = new Array(9).fill(0), binTot = new Array(9).fill(0), arrSum = new Array(9).fill(0), arrCnt = new Array(9).fill(0);
    for (let i = 0; i < N; i++) {
      if (!live[i]) continue;
      const d = Math.hypot(px0[i] - tx, py0[i] - ty);
      const k = Math.min(8, Math.floor(d / 50));
      if (d > 600) { strayCnt++; continue; }                     // 掉队散鸟(离群 >600px)与"群"无关, 不计入
      if (minSp[i] < SP_MIN) slowCnt++;                          // 只统计不剔除
      binTot[k]++;
      if (d < 110) { nearTurn += maxDev[i]; nearCnt++; }
      if (maxDev[i] > DEV_TH) {
        nAff++; bins[k]++; arrSum[k] += firstDev[i]; arrCnt[k]++;
        if (d > maxDist) maxDist = d;
        for (const T of [30, 60, 90, 150]) if (firstDev[i] <= Math.min(T, WAVE) && d > at[T]) at[T] = d;
        if (process.env.W2_DEBUG === "1") dbgList.push({ t, d, f: firstDev[i], dev: maxDev[i], sp: minSp[i] });
      }
    }
    /* 稳健口径: 从触发点向外逐 50px 环看"被带动比例"; 连续传播半径 = 第一段跌破阈值前的半径。
     * 不用"最远单个被带动个体": 45° 阈值附近的长尾是个体混沌噪声(基线 400+px 处偏转只有 46~58°),
     * 环内比例要求整整一片鸟都被带起来, 才叫可见的传播。 */
    const reach = thr => {
      let Rr = 0;
      for (let k = 0; k < 9; k++) {
        if (binTot[k] < 5) break;
        if (bins[k] / binTot[k] < thr) break;
        Rr = (k + 1) * 50;
      }
      return Rr;
    };
    trials.push({ tdist: Math.hypot(tx - cx0, ty - cy0), edgeGap, nAff, maxDist, at, bins, binTot,
                  nearTurn: nearCnt ? nearTurn / nearCnt : 0, slowCnt, R25: reach(0.25), R50: reach(0.5), R10: reach(0.1) });
    // 恢复期: 让鸟群回到巡航态再触发下一次(否则上一次的波会叠加)
    for (let f = 0; f < RECOVER; f++) { SIM_A.parkRaptors(); SIM_B.parkRaptors(); SIM_A.step(); SIM_B.step(); }
  }
  if (process.env.W2_DEBUG === "1") {
    dbgList.sort((a, b) => b.d - a.d);
    for (const x of dbgList.slice(0, 6)) console.log(`      [最远被带动] 第${x.t + 1}次 d=${x.d.toFixed(0)}px 首达${x.f}f 偏转${x.dev.toFixed(0)}° 最小速率${x.sp.toFixed(2)}`);
  }
  // 多次触发的平均(波前半径/分箱比例按次平均)
  const aw = (arr, k) => arr.reduce((a, x) => a + x[k], 0) / arr.length;
  const binsAvg = new Array(9).fill(0), totAvg = new Array(9).fill(0);
  for (const tr of trials) for (let k = 0; k < 9; k++) { binsAvg[k] += tr.bins[k]; totAvg[k] += tr.binTot[k]; }
  for (let k = 0; k < 9; k++) { binsAvg[k] /= trials.length; totAvg[k] /= trials.length; }
  const S = { tdist: aw(trials, "tdist"), edgeGap: Math.min(...trials.map(x => x.edgeGap)), slowCnt: aw(trials, "slowCnt"), nearTurn: aw(trials, "nearTurn"), nAff: aw(trials, "nAff"), maxDist: Math.max(...trials.map(x => x.maxDist)), maxDistAvg: aw(trials, "maxDist"), R25: aw(trials, "R25"), R50: aw(trials, "R50"), R10: aw(trials, "R10") };
  for (const T of [30, 60, 90, 150]) S["at" + T] = trials.reduce((a, x) => a + x.at[T], 0) / trials.length;
  return {
    seed, warmMs, n0, t0Diff, gravity: SIM_A.gravity,
    order: sumOrder / nOrd, minOrder, nn: sumNN / nNN, minNN, maxNN,
    r90: rMean, r90cv: Math.sqrt(rVar) / rMean, r90trend: (rLast - rFirst) / rMean,
    groupTurnDeg: sumTurn * R2D, speedMean: sumSpeed / nOrd,
    skippedEdge, worldW: WW, worldH: HH, nOrd, trials: trials.length,
    SP_MIN, w: S, binsAvg, totAvg,
    turnP50: turnPct(histTurnFast, 0.5), turnP99: turnPct(histTurnFast, 0.99),
    turnP999: turnPct(histTurnFast, 0.999), turnMax: turnPct(histTurnFast, 0.99999),
    turnP999All: turnPct(histTurn, 0.999),
  };
}

const results = [];
for (let k = 0; k < SEEDS; k++) results.push(measure(20261015 + k * 101));
const R = results[0];
const avg = k => results.reduce((a, r) => a + r[k], 0) / results.length;
const avgW = k => results.reduce((a, r) => a + r.w[k], 0) / results.length;
const maxW = k => Math.max(...results.map(r => r.w[k]));
const f1 = x => x.toFixed(1);
if (SEEDS > 1) for (const r of results) console.log(`  种子${r.seed}: order=${r.order.toFixed(3)} NN=${f1(r.nn)} R90=${f1(r.r90)} CV=${(100 * r.r90cv).toFixed(1)}% R25=${f1(r.w.R25)} Rmax=${f1(r.w.maxDistAvg)}`);
const binsAvgAll = new Array(9).fill(0), totAvgAll = new Array(9).fill(0);
for (const r of results) for (let k = 0; k < 9; k++) { binsAvgAll[k] += r.binsAvg[k]; totAvgAll[k] += r.totAvg[k]; }
for (let k = 0; k < 9; k++) { binsAvgAll[k] /= results.length; totAvgAll[k] /= results.length; }
const binStr = binsAvgAll.map((v, i) => `${i * 50}:${totAvgAll[i] ? (100 * v / totAvgAll[i]).toFixed(0) + "%" : "-"}`).join(" ");
console.log(`==== W2 涌现探针: ${label} ====`);
console.log(`(html: ${htmlPath})`);
console.log(`N=${R.n0} 世界=${R.worldW}x${R.worldH} 重力=${R.gravity} 预热${WARM} 巡航${CRUISE}(有效采样 ${R.nOrd}, 边界600px内跳过 ${R.skippedEdge}) 波窗${WAVE} 触发${R.trials}次 × 种子${SEEDS}`);
console.log(`(a) 极化度 order = ${avg("order").toFixed(3)}   (最小 ${R.minOrder.toFixed(3)}, 目标 ≥0.80)`);
console.log(`    刚性对照: 群体平均航向累计转过 ${f1(R.groupTurnDeg)}°, 平均速度 ${R.speedMean.toFixed(2)}`);
console.log(`(b) 抽样最近邻平均距离 = ${f1(avg("nn"))}px  (区间 ${f1(R.minNN)}~${f1(R.maxNN)}, 目标 5~10px)`);
console.log(`(c) 群体 90% 分位半径 R90 = ${f1(avg("r90"))}px  相对波动 CV ${(100 * avg("r90cv")).toFixed(1)}%  首尾趋势 ${(100 * R.r90trend).toFixed(1)}%`);
console.log(`(d) 惊飞波: 触发鸟离质心 ${f1(avgW("tdist"))}px, 离世界边界最紧 ${f1(R.w.edgeGap)}px; 半径110px 内平均偏转 ${f1(avgW("nearTurn"))}°`);
console.log(`    被带动(|vA-vB| > ${R.SP_MIN.toFixed(1)}px/帧 ≈ 全速下 45° 转向): ${(100 * avgW("nAff") / R.n0).toFixed(1)}% 个体; 最远单个 = ${f1(maxW("maxDist"))}px (均值 ${f1(avgW("maxDistAvg"))}, 目标 ≥300)`);
console.log(`    连续传播半径(环内被带动比例达标): R10 ${f1(avgW("R10"))}px / R25 ${f1(avgW("R25"))}px <- 主口径 / R50 ${f1(avgW("R50"))}px`);
console.log(`    波前半径: ≤30帧 ${f1(avgW("at30"))}px  ≤60帧 ${f1(avgW("at60"))}px  ≤90帧 ${f1(avgW("at90"))}px  全窗口 ${f1(avgW("at150"))}px`);
console.log(`    (距离px:被带动%) ${binStr}`);
console.log(`    巡航航向变化率(全速口径, 度/帧): 中位 ${R.turnP50.toFixed(2)} / P99 ${R.turnP99.toFixed(2)} / P99.9 ${R.turnP999.toFixed(2)} / 最大档 ${R.turnMax.toFixed(2)}   (不限速 P99.9 ${R.turnP999All.toFixed(2)} = 慢速噪声)`);
console.log(`    预热单帧 ${R.warmMs.toFixed(2)}ms; 速率 <${R.SP_MIN.toFixed(1)} 被剔除的个体 ${f1(avgW("slowCnt"))}/次`);
console.log(`[汇总] order=${avg("order").toFixed(3)} NN=${f1(avg("nn"))} R90=${f1(avg("r90"))} CV=${(100 * avg("r90cv")).toFixed(1)}% R25=${f1(avgW("R25"))} Rmax=${f1(maxW("maxDist"))}`);
