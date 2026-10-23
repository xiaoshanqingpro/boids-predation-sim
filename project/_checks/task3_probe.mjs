/* ============================================================================
 * W3 / task-3 探针: 隼的冲刺与运动异常定量 (a)-(e)
 *   (a) 每次冲刺捕获数      = 总捕获 / 隼的冲刺次数(与 diag_stoop 同口径) + 冲刺内实际吃到的只数
 *   (b) 空冲刺率            = 未锁定冲刺/全部冲刺 与 dashEats=0/全部冲刺
 *   (c) 冲刺航向夹角        = 冲刺瞬间"发射前速度"与"新冲刺方向"的夹角 P50/P90(俯冲/平飞分开)
 *   (d) 巡航高度            = 非冲刺帧 (z - 鸟群均高) 的方差 + |Δz|/帧 + vz 反向次数 + 自相关周期
 *   (e) 连续冲刺间隔        = 同一只隼两次冲刺起始的帧间隔: mean/sd/CV
 * 口径与 _checks/diag_stoop.mjs 对齐: N=2000 / 无边界 / 重力开 / 关闭补充 / 5000 帧。
 * 【重要】随机种子固定(Mulberry32 替换 Math.random), 否则单次运行的总捕获在 42~109 之间乱跳,
 * 根本没法比较。默认跑 3 个种子, 打印每次 + 汇总(mean [min,max])。
 * 用法: node _checks/task3_probe.mjs [file.html] [frames] [runs] [seed0]
 * ========================================================================== */
import fs from "node:fs"; import vm from "node:vm";
const FILE = process.argv[2] && process.argv[2].endsWith(".html") ? process.argv[2] : "掠食竞赛.html";
const FRAMES = Number(process.argv[3] || 5000);
const RUNS = Number(process.argv[4] || 3);
const SEED0 = Number(process.argv[5] || 20261015);

const html = fs.readFileSync(FILE, "utf8");
const cut = html.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? html.slice(0, cut) : html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n;\n");

function seededMath(seed) {
  let s = seed >>> 0;
  const M = Object.create(Math);
  M.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return M;
}

function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: 0, sd: 0, cv: 0, p50: 0, p90: 0, min: 0, max: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n;
  const v = a.reduce((x, y) => x + (y - m) * (y - m), 0) / n;
  const s = a.slice().sort((x, y) => x - y);
  return { n, mean: m, sd: Math.sqrt(v), cv: m > 1e-9 ? Math.sqrt(v) / m : 0, p50: s[n >> 1], p90: s[Math.min(n - 1, Math.floor(n * 0.9))], min: s[0], max: s[n - 1] };
}
function hist(a, w) { const h = new Map(); for (const x of a) { const b = Math.floor(x / w) * w; h.set(b, (h.get(b) || 0) + 1); } return [...h.entries()].sort((x, y) => x[0] - y[0]); }

function runOnce(seed) {
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad : (p === "measureText" ? () => ({ width: 10 }) : () => {})), set: (t, p, v) => (t[p] = v, true) });
  const els = new Map();
  const mk = id => ({ id, textContent: "", innerHTML: "", value: "2000", checked: false, style: {}, className: "", children: [], addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, getContext: () => ctx, appendChild(c) { return c; }, removeChild(c) { return c; }, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) });
  const d = { getElementById: id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, addEventListener() {}, createElement: () => mk("c") };
  const sb = { document: d, window: { addEventListener() {}, removeEventListener() {}, location: { search: "" } }, location: { search: "" }, Math: seededMath(seed), performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console };
  vm.createContext(sb); vm.runInContext(code, sb, { filename: "sim.js" });
  const SIM = sb.window.SIM;
  SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(false);

  const F_ = SIM.raptorCount.falcons, RA = SIM.raptorCount.total, GROUND_MARGIN = 30;
  // 按 kind 认隼(第 8 轮起 hunter() 带 kind; 早期版本按下标前 F_ 个)
  const fidx = [];
  for (let k = 0; k < RA; k++) { const hh = SIM.hunter(k); if (hh.kind ? hh.kind === "falcon" : k < F_) fidx.push(k); }
  const F = fidx.length;
  const comp = { unlocked: 0, mob: 0, clash: 0, missed: 0 };   // 空冲刺构成
  const pv = [], pdash = [], pz = [];
  const per = [];
  for (let k = 0; k < F; k++) per.push({ starts: 0, locked: 0, ends: 0, eats: 0, empty: 0, startFrames: [], ang: [], angDive: [], angLevel: [], angTry: [], energyAtStart: [],
    cruiseN: 0, cS: 0, cS2: 0, c40: 0, dzAbs: 0, vzRev: 0, lastSign: 0, zs: [], nearGround: 0, dashFrames: 0, climb: 0, vzMin: 0, jumps: 0,
    pullN: 0, pullSum: 0, pullCd: 0, pullBase: 0, postDash: 0, stoopFrames: 0,
    coolFrames: 0, readyFrames: 0, readyLowE: 0, mob0: 0, cl0: 0, lastLock: -2, mobInt: 0, missed: 0,
    lockDash: 0, lockEats: 0, freeDash: 0, freeEats: 0, gooseDash: 0, gooseAmb: 0,
    eMin: 1e9, eMax: -1e9, eSum: 0, eN: 0, eHist: new Array(10).fill(0) });
  const pkills = new Array(RA).fill(0);
  let gooseKilled = 0, handoffs = 0, activeNow = -1;
  for (let k = 0; k < RA; k++) { pv.push(null); pdash.push(0); pz.push(0); }
  const A = { ang: [], angDive: [], angLevel: [], gap: [], over60: 0, rej: 0 };
  let lastRej = -99;

  for (let f = 0; f < FRAMES; f++) {
    for (let k = 0; k < RA; k++) { const h = SIM.hunter(k); pv[k] = [h.vx, h.vy, h.vz]; pdash[k] = h.dashT; pz[k] = h.z; }
    const g0 = SIM.galiveCount;
    SIM.step();
    { const a = SIM.raptorRefs().activeId; if (activeNow !== a) { if (activeNow >= 0) handoffs++; activeNow = a; } }   // p2 交棒次数
    const zr = SIM.zRange; const fMean = zr.starling ? zr.starling.mean : 170;
    // 雁被捕食都归到击杀者头上(雁数掉了的那一帧, 谁 kills 增加就是谁), 用来拆"椋鸟/雁"捕获构成
    if (SIM.galiveCount < g0) {
      gooseKilled += g0 - SIM.galiveCount;
      for (let k = 0; k < RA; k++) {
        const hh = SIM.hunter(k);
        if (hh.kills > pkills[k]) {
          if (hh.kind !== "falcon") { pkills[k] = hh.kills; continue; }
          const P = per[fidx.indexOf(k)];
          if (P) { if (hh.dashT > 0) P.gooseDash += hh.kills - pkills[k]; else P.gooseAmb += hh.kills - pkills[k]; }
          pkills[k] = hh.kills;
        }
      }
    }
    for (let k = 0; k < F; k++) {
      const rk = fidx[k];
      const h = SIM.hunter(rk), P = per[k], was = pdash[rk] > 0, now = h.dashT > 0;
      P.eSum += h.energy; P.eN++; if (h.energy < P.eMin) P.eMin = h.energy; if (h.energy > P.eMax) P.eMax = h.energy;
      P.eHist[Math.min(9, Math.max(0, Math.floor(h.energy / 10)))]++;
      if (!was && now) {
        P.starts++;
        if (h.lockIdx >= 0) { P.locked++; P.lockDash++; } else P.freeDash++;
        P.lastLock = h.lockIdx;
        P.mob0 = SIM.stats.mobInterrupts; P.cl0 = SIM.stats.clashes;
        P.startFrames.push(f);
        const hd = SIM.hunterDetail(rk);
        if (hd && hd.dashAng >= 0) P.angTry.push(hd.dashAng * 180 / Math.PI);   // tryDash 真正用的三维夹角
        const a0 = Math.hypot(pv[rk][0], pv[rk][1], pv[rk][2]), a1 = Math.hypot(h.vx, h.vy, h.vz);
        if (a0 > 1e-9 && a1 > 1e-9) {
          let c = (pv[rk][0] * h.vx + pv[rk][1] * h.vy + pv[rk][2] * h.vz) / (a0 * a1);
          c = Math.min(1, Math.max(-1, c));
          const deg = Math.acos(c) * 180 / Math.PI;
          P.ang.push(deg); A.ang.push(deg);
          if (h.vz < -0.5) { P.angDive.push(deg); A.angDive.push(deg); } else { P.angLevel.push(deg); A.angLevel.push(deg); }
          if (deg > 60) A.over60++;
        }
      }
      if (was && !now) { P.ends++;
        if ((h.dashEats || 0) === 0) {                 // 空冲刺构成: 未锁定 / 被围攻打断 / 被互攻打断 / 锁定但错过
          P.empty++;
          if (P.lastLock < 0) comp.unlocked++;
          else if (SIM.stats.mobInterrupts > P.mob0) { comp.mob++; P.mobInt++; }
          else if (SIM.stats.clashes > P.cl0) comp.clash++;
          else { comp.missed++; P.missed++; }
        } else P.eats += h.dashEats;
        if (P.lastLock >= 0) P.lockEats += h.dashEats; else P.freeEats += h.dashEats;   // 锁定冲刺 vs 未锁定冲刺的捕获
        P.pullCd = 60; P.pullBase = h.z; P.pullN++; P.pullSum = 0; }        // 记录冲刺后 60 帧的下潜过冲
      if (was === now) { const dv = Math.hypot(h.vx - pv[rk][0], h.vy - pv[rk][1], h.vz - pv[rk][2]); if (dv > 4.0) P.jumps++; }
      if (P.pullCd > 0) { P.pullCd--; if (h.z - P.pullBase < P.pullSum) P.pullSum = h.z - P.pullBase; if (P.pullCd === 0) P.postDash += P.pullSum; }
      if (SIM.stoop[rk] > 0) P.stoopFrames++;
      if (now) {
        P.dashFrames++;
        if (h.vz < P.vzMin) P.vzMin = h.vz;
        if (h.vz > 0.2) P.climb++;
        if (h.z < GROUND_MARGIN + 8 && h.vz > 0.2) P.nearGround++;
      } else {
        const hd = SIM.hunterDetail(rk);
        if (hd) { if (hd.circleT > 0) P.coolFrames++; else { P.readyFrames++; if (hd.energy < 60) P.readyLowE++; } }   // 冷却 vs 就绪(能量够不够 60 上限)
        const dz = h.z - fMean;
        P.cruiseN++; P.cS += dz; P.cS2 += dz * dz;
        if (Math.abs(dz) > 40) P.c40++;
        P.dzAbs += Math.abs(h.z - pz[rk]);
        const s = h.vz > 0.02 ? 1 : (h.vz < -0.02 ? -1 : 0);
        if (s && P.lastSign && s !== P.lastSign) P.vzRev++;
        if (s) P.lastSign = s;
        P.zs.push(h.z);
      }
    }
    if (f % 5 === 0) for (const e of SIM.log(400)) if (/落空/.test(e.msg) && e.frame > lastRej) { A.rej++; lastRej = e.frame; }
  }
  for (const P of per) for (let i = 1; i < P.startFrames.length; i++) A.gap.push(P.startFrames[i] - P.startFrames[i - 1]);
  let cN = 0, cS = 0, cS2 = 0, c40 = 0, dzA = 0, vzR = 0, nearG = 0, climb = 0, vzMin = 0, jumps = 0, dashF = 0, postD = 0, postN = 0, stoopF = 0;
  for (const P of per) { cN += P.cruiseN; cS += P.cS; cS2 += P.cS2; c40 += P.c40; dzA += P.dzAbs; vzR += P.vzRev; nearG += P.nearGround; climb += P.climb; vzMin = Math.min(vzMin, P.vzMin); jumps += P.jumps; dashF += P.dashFrames;
    postD += P.postDash; postN += P.pullN; stoopF += P.stoopFrames; }
  const cMean = cS / Math.max(1, cN), cVar = cS2 / Math.max(1, cN) - cMean * cMean;
  let bestLag = 0, bestR = 0;
  for (const P of per) {
    const zs = P.zs, n = zs.length; if (n < 600) continue;
    let m = 0; for (const z of zs) m += z; m /= n;
    const dev = zs.map(z => z - m); let v0 = 0; for (const x of dev) v0 += x * x; v0 /= n;
    if (v0 < 1e-6) continue;
    for (let L = 40; L <= Math.min(400, n >> 1); L += 5) { let s = 0; for (let i = 0; i + L < n; i++) s += dev[i] * dev[i + L]; const r = s / (n - L) / v0; if (r > bestR) { bestR = r; bestLag = L; } }
  }
  const tot = { dash: 0, locked: 0, ends: 0, empty: 0, eats: 0, cool: 0, ready: 0, readyLowE: 0 };
  for (const P of per) { tot.dash += P.starts; tot.locked += P.locked; tot.ends += P.ends; tot.empty += P.empty; tot.eats += P.eats;
    tot.cool += P.coolFrames; tot.ready += P.readyFrames; tot.readyLowE += P.readyLowE; }
  const angTryList = per.flatMap(P => P.angTry);
  const agg2 = (f2n) => per.reduce((a, P) => a + f2n(P), 0);
  const eHist = new Array(10).fill(0); for (const P of per) for (let i = 0; i < 10; i++) eHist[i] += P.eHist[i];
  return { seed, kills: SIM.kills.slice(), killsSum: SIM.kills.reduce((a, b) => a + b, 0), perKills: SIM.kills.slice(),
           lockDash: agg2(P => P.lockDash), lockEats: agg2(P => P.lockEats), freeDash: agg2(P => P.freeDash), freeEats: agg2(P => P.freeEats),
           perFalcon: per.map(P => ({ starts: P.starts, locked: P.locked, lockDash: P.lockDash, lockEats: P.lockEats, freeDash: P.freeDash,
             empty: P.empty, mobInt: P.mobInt, missed: P.missed, gooseDash: P.gooseDash, gooseAmb: P.gooseAmb, dashFrames: P.dashFrames,
             cool: P.coolFrames, ready: P.readyFrames, eMin: P.eMin })),
           gooseDash: agg2(P => P.gooseDash), gooseAmb: agg2(P => P.gooseAmb), gooseKilled, starlingKilled: SIM.kills.reduce((a, b) => a + b, 0) - gooseKilled,
           eMin: Math.min(...per.map(P => P.eMin)), eMean: agg2(P => P.eSum) / Math.max(1, agg2(P => P.eN)), eHist, handoffs,
           ...tot, comp: { ...comp }, angTryList,
           cruiseN: cN, cruiseMean: cMean, cruiseVar: Math.max(0, cVar), c40: c40 / Math.max(1, cN), dzAbs: dzA / Math.max(1, cN),
           vzRev: vzR, dashFrames: dashF, climb, nearG, vzMin, jumps, bestLag, bestR, stoopFrames: stoopF,
           postDash: postD / Math.max(1, postN), postN,
           missFalcon: SIM.stats.missFalcon, noLockAborts: SIM.stats.noLockAborts, rej: A.rej,
           ang: stat(A.ang), angDive: stat(A.angDive), angLevel: stat(A.angLevel), over60: A.over60,
           angList: A.ang, angDiveList: A.angDive, angLevelList: A.angLevel,
           gap: stat(A.gap), gapList: A.gap, hist: hist(A.gap, 20) };
}

const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(runOnce(SEED0 + i * 7919));
const agg = (arr) => ({ mean: arr.reduce((a, b) => a + b, 0) / arr.length, min: Math.min(...arr), max: Math.max(...arr) });
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
const pooledGap = runs.flatMap(r => r.gapList);
const stGap = stat(pooledGap);
const totDashA = agg(runs.map(r => r.dash));

console.log("=== task-3 探针 " + FILE + " | " + FRAMES + " 帧 × " + RUNS + " 个固定种子(" + SEED0 + "+7919k) | N=2000, grav=on, 无补充 ===");
for (const r of runs) {
  console.log("  seed " + r.seed + ": 总捕获 " + r.killsSum + " [隼①" + r.kills[0] + " 隼②" + r.kills[1] + " 鹰" + r.kills[2] + "]" +
    " | 冲刺 " + r.dash + "(锁定 " + r.locked + ") 空 " + r.empty + " 冲刺内吃 " + r.eats +
    " | 巡航 sd=" + Math.sqrt(r.cruiseVar).toFixed(1) + " |Δz|=" + r.dzAbs.toFixed(3) + " vz反向=" + r.vzRev + " | 间隔CV=" + r.gap.cv.toFixed(2));
}
console.log("(a) 每次冲刺捕获 = 总捕获/冲刺: " + runs.map(r => f2(r.killsSum / Math.max(1, r.dash))).join(" / ") +
            "  -> mean " + f2(agg(runs.map(r => r.killsSum / Math.max(1, r.dash))).mean) +
            " [" + f2(agg(runs.map(r => r.killsSum / Math.max(1, r.dash))).min) + "," + f2(agg(runs.map(r => r.killsSum / Math.max(1, r.dash))).max) + "]" +
            " | 冲刺内实际吃到/次: " + f2(runs.reduce((a, r) => a + r.eats, 0) / Math.max(1, runs.reduce((a, r) => a + r.ends, 0))) +
            " | 总捕获 mean " + f1(agg(runs.map(r => r.killsSum)).mean) + " | 隼合计捕获 mean " + f1(agg(runs.map(r => r.kills[0] + r.kills[1])).mean) + " / 鹰 " + f1(agg(runs.map(r => r.kills[2])).mean));
console.log("(b) 未锁定冲刺/全部 = " + f1(100 * agg(runs.map(r => (r.dash - r.locked) / Math.max(1, r.dash))).mean) + "%" +
            " | 真·空冲刺(dashEats=0)/结束 = " + f1(100 * runs.reduce((a, r) => a + r.empty, 0) / Math.max(1, runs.reduce((a, r) => a + r.ends, 0))) + "%" +
            " | 落空(夹角过大,估)/次: " + f1(agg(runs.map(r => r.rej)).mean) + " | 无目标放弃 " + f1(agg(runs.map(r => r.noLockAborts)).mean));
const csum = runs.reduce((a, r) => ({ unlocked: a.unlocked + r.comp.unlocked, mob: a.mob + r.comp.mob, clash: a.clash + r.comp.clash, missed: a.missed + r.comp.missed }), { unlocked: 0, mob: 0, clash: 0, missed: 0 });
const ctot = Math.max(1, csum.unlocked + csum.mob + csum.clash + csum.missed);
console.log("(b2) 空冲刺构成(池化 " + ctot + " 次): 未锁定 " + csum.unlocked + "(" + f1(100 * csum.unlocked / ctot) + "%) 锁定但错过 " + csum.missed + "(" + f1(100 * csum.missed / ctot) + "%)" +
            " 被围攻打断 " + csum.mob + "(" + f1(100 * csum.mob / ctot) + "%) 被互攻打断 " + csum.clash + "(" + f1(100 * csum.clash / ctot) + "%)");
console.log("     出手机会侧: 就绪帧(circleT<=0 非冲刺) " + f1(agg(runs.map(r => r.ready)).mean) + " [能量<60 的占 " + f1(100 * runs.reduce((a, r) => a + r.readyLowE, 0) / Math.max(1, runs.reduce((a, r) => a + r.ready, 0))) + "%]" +
            " 冷却帧(circleT>0) " + f1(agg(runs.map(r => r.cool)).mean) +
            " | 就绪帧里出手 " + f1(100 * agg(runs.map(r => r.dash / Math.max(1, r.ready))).mean) + "% (其余: 视野内无鸟/40px 内无鸟/夹角不合格)");
const sTry = stat(runs.flatMap(r => r.angTryList));
const SEC = FRAMES / 60;   // 帧 -> 秒(60fps)
const sum = (k) => runs.reduce((a, r) => a + r[k], 0);
const fFal = runs.reduce((a, r) => a + r.kills[0] + r.kills[1], 0), fEag = runs.reduce((a, r) => a + r.kills[2], 0);
console.log("── Lead 要的 5 个数(5 种子池化) ─────────────────────────────");
console.log("1) 捕获/全部冲刺 = " + f2(sum("killsSum") / Math.max(1, sum("dash"))) + "   [全部捕获 " + sum("killsSum") + " / 冲刺 " + sum("dash") + "]");
console.log("2) 捕获/锁定冲刺 = " + f2(sum("killsSum") / Math.max(1, sum("lockDash"))) + "   [锁定冲刺 " + sum("lockDash") + " 次; 未锁定 " + sum("freeDash") + " 次]" +
            "  | 冲刺内实际吃到: 锁定 " + f2(sum("lockEats") / Math.max(1, sum("lockDash"))) + "/次, 未锁定 " + f2(sum("freeEats") / Math.max(1, sum("freeDash"))) + "/次");
console.log("3) 冲刺频率 = " + f1(sum("dash") / runs.length / SEC * 60) + " 次/分钟(两只隼合计) = " + f1(sum("dash") / runs.length / 2 / SEC * 60) + " 次/分钟/只" +
            " | 冲刺占空比 " + f1(100 * sum("dashFrames") / (FRAMES * runs.length * 2)) + "% / 盘旋巡飞 " + f1(100 - 100 * sum("dashFrames") / (FRAMES * runs.length * 2)) + "%");
console.log("5) 捕获构成: 池化 椋鸟 " + sum("starlingKilled") + " 只 / 雁 " + sum("gooseKilled") + " 只 (雁占 " + f1(100 * sum("gooseKilled") / Math.max(1, sum("killsSum"))) + "%)" +
            " | 隼 " + fFal + " / 鹰 " + fEag + " | 隼的冲刺内雁捕获 " + sum("gooseDash") + " 只(其余雁为被动/巡飞撞到 " + sum("gooseAmb") + ")");
const eh = runs.reduce((a, r) => r.eHist.map((v, i) => a[i] + v), new Array(10).fill(0));
const eTot = eh.reduce((a, b) => a + b, 0), eLow60 = eh.slice(0, 6).reduce((a, b) => a + b, 0);
console.log("能量证据: 全程最低能量 " + f1(Math.min(...runs.map(r => r.eMin))) + ", 均值 " + f1(runs.reduce((a, r) => a + r.eMean, 0) / runs.length) +
            " | 能量<60 帧占比 " + f2(100 * eLow60 / Math.max(1, eTot)) + "% (判据 iii 要 ≥5%)" +
            " | 能量直方(0-10,10-20,…): " + eh.join("/") + " (共 " + eTot + " 帧) | 就绪帧里能量<60 的比例 " +
            f1(100 * sum("readyLowE") / Math.max(1, sum("ready"))) + "% | p2 交棒次数(activeId 变更) " + sum("handoffs") + " 次/" + runs.length + " 种子");
// 逐隼拆分(Lead 要的"隼#0 为什么吃不到"): 冲刺数/锁定冲刺/冲刺内吃到/空冲刺构成/捕获(总)
for (let i = 0; i < runs[0].perFalcon.length; i++) {
  const pf = runs.map(r => r.perFalcon[i]);
  const S = (k) => pf.reduce((a, p) => a + p[k], 0);
  const kills = runs.reduce((a, r) => a + (r.kills[i] || 0), 0);
  console.log("   隼#" + i + ": 冲刺 " + S("starts") + "(锁定 " + S("locked") + ", 未锁定 " + S("freeDash") + ") 冲刺内吃到 " + S("lockEats") +
    " | 捕获(总) " + kills + " ⇒ 捕获/全部冲刺 " + f2(kills / Math.max(1, S("starts"))) + ", 捕获/锁定冲刺 " + f2(kills / Math.max(1, S("lockDash"))) +
    ", 冲刺内吃到/锁定冲刺 " + f2(S("lockEats") / Math.max(1, S("lockDash"))) +
    " | 空冲刺 " + S("empty") + "(被围攻打断 " + S("mobInt") + " / 锁定后错过 " + S("missed") + ")" +
    " | 冲刺占空比 " + f1(100 * S("dashFrames") / (FRAMES * runs.length)) + "%, 冷却帧 " + S("cool") + ", 就绪帧 " + S("ready") +
    " | 冲刺内雁捕获 " + S("gooseDash") + " 只, 最低能量 " + f1(Math.min(...pf.map(p => p.eMin))));
}
console.log("(c2) tryDash 实际判定夹角(f.dashAng, 池化 " + sTry.n + " 次): P50=" + f2(sTry.p50) + "° P90=" + f2(sTry.p90) + "° mean=" + f2(sTry.mean) + "° max=" + f2(sTry.max) + "° (阈值 60°)");
const pAng = (k) => runs.flatMap(r => r[k + "List"]);
const sAll = stat(pAng("ang")), sDive = stat(pAng("angDive")), sLevel = stat(pAng("angLevel"));
const pooled = runs.flatMap(r => r.gapList), sGap = stat(pooled);
console.log("(c) 冲刺夹角(池化 " + sAll.n + " 次): 全体 P50=" + f1(sAll.p50) + "° P90=" + f1(sAll.p90) + "° mean=" + f1(sAll.mean) +
            "° max=" + f1(sAll.max) + " | 俯冲段 n=" + sDive.n + " P50=" + f1(sDive.p50) + "° P90=" + f1(sDive.p90) +
            "° / 平飞段 n=" + sLevel.n + " P50=" + f1(sLevel.p50) + "° P90=" + f1(sLevel.p90) + "°" +
            " | >60° 次数 mean " + f1(agg(runs.map(r => r.over60)).mean) + "(旧版一律拒绝)");
console.log("(d) 巡航高度 (z-鸟群均高): 方差 mean " + f1(agg(runs.map(r => r.cruiseVar)).mean) + " [" + f1(agg(runs.map(r => r.cruiseVar)).min) + "," + f1(agg(runs.map(r => r.cruiseVar)).max) + "]" +
            " sd mean " + f1(agg(runs.map(r => Math.sqrt(r.cruiseVar))).mean) +
            " | 偏离均值 " + f1(agg(runs.map(r => r.cruiseMean)).mean) + "px | 高于40px " + f1(100 * agg(runs.map(r => r.c40)).mean) + "%" +
            " | |Δz|/帧 " + runs.map(r => r.dzAbs.toFixed(3)).join("/") +
            " | vz反向/千帧 " + f1(agg(runs.map(r => 1000 * r.vzRev / Math.max(1, r.cruiseN))).mean) +
            " | 自相关周期 " + runs.map(r => r.bestLag + "(r=" + r.bestR.toFixed(2) + ")").join("/"));
console.log("(e) 冲刺间隔(池化 " + sGap.n + " 个): mean=" + f1(sGap.mean) + " sd=" + f1(sGap.sd) + " CV=" + f2(sGap.cv) +
            " P50=" + f1(sGap.p50) + " min=" + f1(sGap.min) + " max=" + f1(sGap.max) +
            " | 每次运行 CV: " + runs.map(r => f2(r.gap.cv)).join("/") + " | 直方(20帧/格) " + JSON.stringify(hist(pooled, 20)));
console.log("   冲刺次数 mean " + f1(totDashA.mean) + " [" + totDashA.min + "," + totDashA.max + "] 全程 " + totDashA.mean + " 次/5000帧, 无目标放弃 mean " + f1(agg(runs.map(r => r.noLockAborts)).mean) +
            " | 冲刺中爬升帧 " + f1(agg(runs.map(r => r.climb)).mean) + " 贴地拉起帧 " + f1(agg(runs.map(r => r.nearG)).mean) +
            " 最负 vz " + f1(agg(runs.map(r => r.vzMin)).mean) + " | 非起始帧速度突变 " + f1(agg(runs.map(r => r.jumps)).mean) +
            " | 俯冲相帧/千帧 " + f1(agg(runs.map(r => 1000 * r.stoopFrames / (FRAMES * RUNS))).mean) +
            " | 冲刺后 60 帧下潜过冲均值 " + f1(agg(runs.map(r => r.postDash)).mean) + "px");
