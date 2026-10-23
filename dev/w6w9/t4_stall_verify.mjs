/* ============================================================================
 * T4 —— W5 失速段回归验证（防回归，不改机制）
 * 用法: node _w6w9/t4_stall_verify.mjs [html] [frames] [seeds]
 *   默认 掠食竞赛(4).html / 8000 帧 / 4 种子
 * 验收（施工文档 T4 节）:
 *   ① stats.ghunterStallFrames >= stats.ghunterAttacks × GH_STALL_FRAMES × 0.9
 *   ② 三条结算路径(命中/落空/被打断)每条都设 stall —— 运行时统计三条各自次数
 *   ③ 失速段四效果(转艏×0.3 / 禁爬升 / 速度×0.85 / 互攻−2) —— 运行时观察 + 源码行号
 * 只读: 不修改主文件。内容哈希由 jsdom_drive.readHtmlCached 钉扎(同一份内容跑全部种子)。
 * ==========================================================================*/
import { loadSim, readHtmlCached, setRandomSeedOverride, physicsHash } from "./jsdom_drive.mjs";

const HTML = process.argv[2] || "掠食竞赛(4).html";
const FRAMES = Number(process.argv[3] || 8000);
const SEEDS = (process.argv[4] || "101,202,303,404").split(",").map(s => Number(s.trim()) || 1);
const WARMUP = 1500;
const GH_STALL_FRAMES = 45;          // 与主文件常量一致(行 866)
const THRESH = 0.9;

const { sha256, raw } = readHtmlCached(HTML);
const RAW = raw.split("\n");
const lineAt = re => RAW.map((L, i) => [i + 1, L]).filter(([, L]) => re.test(L));
const show = re => lineAt(re).map(([i, L]) => `    L${i}: ${L.trim().slice(0, 165)}`).join("\n") || "    (未匹配到)";
console.log(`=== T4 W5 失速回归验证 ===\nhtml=${HTML}\nsha256=${sha256}\n帧数=${FRAMES} 预热=${WARMUP} 种子=[${SEEDS.join(",")}] 判据=stallFrames >= attacks*${GH_STALL_FRAMES}*${THRESH}\n`);

function ghunterIdx(SIM) {
  const out = [];
  const n = SIM.raptorCount ? SIM.raptorCount.total : 3;
  for (let k = 0; k < n; k++) {
    const d = SIM.hunterDetail ? SIM.hunterDetail(k) : null;
    if (d && d.kind === "ghunter") out.push(k);
  }
  return out;
}
// 默认编制没有雁隼(W4 的 addGhunter 才加), 验收必须先加一只
function ensureGhunter(SIM) {
  let idx = ghunterIdx(SIM);
  if (!idx.length && typeof SIM.addGhunter === "function") {
    SIM.addGhunter();
    idx = ghunterIdx(SIM);
  }
  return idx;
}

const rows = [];
for (const seed of SEEDS) {
  const { SIM, win } = await loadSim(HTML, "");
  setRandomSeedOverride(win, seed);
  const gidx = ensureGhunter(SIM);
  if (!gidx.length) { console.log(`seed ${seed}: addGhunter 后仍然没有 ghunter, 跳过`); continue; }
  // 逐帧采样用 SIM.ghunterInfo(含 stall/attack/dashT/attacks; hunterDetail 不含 stall)
  const gInfo = () => (SIM.ghunterInfo && SIM.ghunterInfo[0]) || null;
  // 预热: 让雁隼进入有猎物的稳态(与 T1 验收口径一致)
  for (let i = 0; i < WARMUP; i++) SIM.step();
  if (SIM.clearLog) SIM.clearLog();
  const base = { attacks: SIM.stats.ghunterAttacks, hits: SIM.stats.ghunterHits, miss: SIM.stats.ghunterMiss,
                 stall: SIM.stats.ghunterStallFrames };

  // 逐帧观察
  let stallFramesObserved = 0;
  const stallCruiseSpeed = [], freeCruiseSpeed = [];
  const stallTurns = [], freeTurns = [];
  let stallClimbFrames = 0, stallVzUpFrames = 0, stallFrameSamples = 0, maxTurnStall = 0, maxTurnFree = 0;
  let stallOverClash = 0, stallOverOther = 0, stallOverOtherBand = 0, freeOverCap = 0, prevClashes = SIM.stats.clashes || 0;
  const stallOverExamples = [];
  const GC = SIM.ghunterConst || { cruiseTurn: 0.35 };
  const capDeg = GC.cruiseTurn * 0.3 * 180 / Math.PI;      // 失速转艏上限(rad/帧 -> deg/帧)
  let hitsPath = 0, missPath = 0, abortPath = 0;      // 三条结算路径的运行时计数
  const prev = new Map();
  let lastLogCount = SIM.logCount || 0;
  const logSeen = new Map();                          // 文本 -> 次数(用日志区分"落空"/"被打断")
  let attackStarts = 0;
  const dashMaxEats = { v: 0 };

  // 一次快照: hunter(k) 给 vx/vy/z/dashT/attack/cool/attacks; ghunterInfo[0] 给 stall
  const k0 = gidx[0];
  const snap = () => {
    const h = SIM.hunter(k0) || {};
    const g = gInfo() || {};
    return { attack: h.attack || 0, dashT: h.dashT || 0, stall: g.stall || 0, z: h.z, x: h.x, y: h.y,
             vx: h.vx, vy: h.vy, cool: h.cool || 0, attacks: h.attacks || 0, miss: SIM.stats.ghunterMiss };
  };

  for (let f = 0; f < FRAMES; f++) {
    const b = snap();
    const hdBefore = SIM.stats.harrierDives || 0;
    SIM.step();
    {
      const d = snap();
      const inDash = (d.dashT || 0) > 0;
      const wasInDash = (b.dashT || 0) > 0;
      if (inDash && !wasInDash) attackStarts++;
      // 三条结算路径归类
      if (d.miss > b.miss) {
        if (b.attack === 1 && (b.dashT || 0) === 0) abortPath++;          // 行 2855 -> ghunterAbort(行 970/975)
        else if (b.attack === 1 && (b.dashT || 0) > 0) missPath++;        // 行 2957-2959 窗口自然走完
      }
      // 失速段运行时量
      const st = d.stall || 0;
      const clashDelta = (SIM.stats.clashes || 0) - prevClashes; prevClashes = SIM.stats.clashes || 0;
      if (st > 0) {
        stallFramesObserved++; stallFrameSamples++;
        if (d.z > b.z + 1e-6) stallClimbFrames++;                        // z 上升帧(含"继承的正 vz 未衰减完")
        if (d.vz !== undefined && b.vz !== undefined && d.vz > b.vz + 1e-6) stallVzUpFrames++;  // 主动加升速 = 违反禁爬升
        if (!inDash) {
          const sp = Math.hypot(d.vx, d.vy);
          stallCruiseSpeed.push(sp);
          const a0 = Math.atan2(b.vy, b.vx), a1 = Math.atan2(d.vy, d.vx);
          let dd = Math.abs(a1 - a0) % (2 * Math.PI); if (dd > Math.PI) dd = 2 * Math.PI - dd;
          const deg = dd * 180 / Math.PI;
          stallTurns.push(deg);
          if (deg > maxTurnStall) maxTurnStall = deg;
          if (deg > capDeg * 1.05) {                                     // 超过"失速转艏上限"的帧
            if (clashDelta > 0) stallOverClash++;
            else {
              stallOverOther++;
              // 归因: ① 互攻击退(已由 clashDelta 分流) ② T3 驱逐鸟非冲刺弹开 ③ applyBoundary 在厌恶带内削减朝外速度
              let nearH = -1;
              try {
                const hi = SIM.harrierInfo;
                const arr = Array.isArray(hi) ? hi : (hi && hi.list) || [];
                for (const hh of arr) { if (hh && hh.alive !== false) { const dd2 = Math.hypot((hh.x ?? 1e9) - d.x, (hh.y ?? 1e9) - d.y); if (nearH < 0 || dd2 < nearH) nearH = dd2; } }
              } catch (e) { /* ignore */ }
              let edgeTxt = "n/a", inBand = false;
              if (SIM.worldInfo) {
                const WI = SIM.worldInfo();
                const e = Math.min(d.x, WI.worldW - d.x, d.y, WI.worldH - d.y);
                inBand = e < (WI.boundR || 420);
                edgeTxt = e.toFixed(0) + "px" + (inBand ? "(厌恶带内)" : "");
              }
              if (inBand) stallOverOtherBand++;
              if (stallOverExamples.length < 5) {
                stallOverExamples.push(`f${SIM.frame}(Δ${deg.toFixed(1)}°, 距边 ${edgeTxt}, 最近驱逐鸟 ` +
                  `${nearH < 0 ? "n/a" : nearH.toFixed(0) + "px"}, harrierDivesΔ${(SIM.stats.harrierDives || 0) - hdBefore})`);
              }
            }
          }
        }
      } else if (!inDash) {
        freeCruiseSpeed.push(Math.hypot(d.vx, d.vy));
        const a0 = Math.atan2(b.vy, b.vx), a1 = Math.atan2(d.vy, d.vx);
        let dd = Math.abs(a1 - a0) % (2 * Math.PI); if (dd > Math.PI) dd = 2 * Math.PI - dd;
        const deg = dd * 180 / Math.PI;
        freeTurns.push(deg);
        if (deg > maxTurnFree) maxTurnFree = deg;
        if (deg > capDeg) freeOverCap++;                                  // 非失速时能超过失速上限 = 上限确实在约束失速段
      }
    }
    if ((SIM.stats.ghunterHits || 0) > 0) { /* 下面统一用差值 */ }
    // 日志取证(区分"落空"与"被打断"): 只取**新增**行(delta), 否则同一行会被重复统计
    const lc = SIM.logCount || 0;
    if (lc !== lastLogCount) {
      const delta = Math.max(1, Math.min(lc - lastLogCount, 30));
      const lines = (SIM.logTail(delta) || []).slice(-delta);
      for (const L of lines) {
        const t = (L && (L.msg || L.text)) || String(L);
        const who = (L && L.who) || "";
        if (!/雁隼/.test(who)) continue;                    // 只统计雁隼自己的日志(否则会把隼/鹰的落空算进来)
        if (/命中雁|攻击路径撞到椋鸟/.test(t)) hitsPath++;
        else if (/落空/.test(t)) logSeen.set("miss", (logSeen.get("miss") || 0) + 1);
        else if (/被打断/.test(t)) logSeen.set("abort", (logSeen.get("abort") || 0) + 1);
      }
      lastLogCount = lc;
    }
  }

  const attacks = SIM.stats.ghunterAttacks - base.attacks;
  const stallFrames = SIM.stats.ghunterStallFrames - base.stall;
  const giEnd = (SIM.ghunterInfo && SIM.ghunterInfo[0]) || null;
  const stallAtEnd = giEnd ? (giEnd.stall || 0) : 0;      // 结束瞬间仍在失速段 -> 解释 ratio 为何略小于 1
  const shortfall = attacks * GH_STALL_FRAMES - stallFrames - stallAtEnd;
  const hits = SIM.stats.ghunterHits - base.hits;
  const miss = SIM.stats.ghunterMiss - base.miss;
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
  const p95 = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.95))] : NaN; };
  const r = {
    seed, attacks, stallFrames, ratio: attacks ? stallFrames / (attacks * GH_STALL_FRAMES) : NaN,
    stallAtEnd, shortfall,
    hits, miss, stallFramesObserved, attackStarts,
    hitResolve: logSeen.get("hit") || hitsPath, missLogged: logSeen.get("miss") || 0, abortLogged: logSeen.get("abort") || 0,
    abortPath, missPath,
    stallSpeedMed: med(stallCruiseSpeed), freeSpeedMed: med(freeCruiseSpeed),
    speedRatio: med(stallCruiseSpeed) / med(freeCruiseSpeed),
    // 中位数会被 mob/stun 等其它减速因子污染(短窗口尤甚); P95 反映"未被扰动的巡航速度", 更稳
    stallSpeedP95: p95(stallCruiseSpeed), freeSpeedP95: p95(freeCruiseSpeed),
    speedRatioP95: p95(stallCruiseSpeed) / p95(freeCruiseSpeed),
    stallTurnP95: p95(stallTurns), freeTurnP95: p95(freeTurns),
    turnRatio: p95(stallTurns) / p95(freeTurns),
    maxTurnStall, maxTurnFree, stallOverClash, stallOverOther, stallOverOtherBand, freeOverCap,
    stallOverExamples: stallOverExamples.join(" "),
    capDeg,
    stallClimbFrames, stallVzUpFrames, stallFrameSamples,
    nStallSamples: stallCruiseSpeed.length, nFreeSamples: freeCruiseSpeed.length,
    phash: physicsHash(SIM), kills: (SIM.kills || []).reduce((a, b) => a + b, 0),
  };
  rows.push(r);
  const okRatio = r.ratio >= THRESH;
  console.log(`seed ${seed}: attacks=${attacks} stallFrames=${stallFrames} ratio=${r.ratio.toFixed(3)} ${okRatio ? "PASS" : "FAIL"} | `
    + `hits=${hits} miss=${miss} 结束剩余失速=${stallAtEnd}(缺口 ${shortfall} 帧) | 结算路径(命中 ${hitsPath}/落空 ${r.missLogged}/打断 ${r.abortLogged}) `
    + `| 速度 ${r.stallSpeedMed.toFixed(2)}/${r.freeSpeedMed.toFixed(2)}=${r.speedRatio.toFixed(3)}× `
    + `| 转艏 max ${r.maxTurnStall.toFixed(2)}/${r.maxTurnFree.toFixed(2)}° (P95 ${r.stallTurnP95.toFixed(2)}/${r.freeTurnP95.toFixed(2)}) `
    + `| 失速 z 上升帧 ${stallClimbFrames}/${stallFrameSamples} / 主动加 vz 帧 ${r.stallVzUpFrames} | phys=${r.phash} kills=${r.kills}`);
}

const ratios = rows.map(r => r.ratio).filter(Number.isFinite);
if (!ratios.length) { console.log("\n没有有效轮次(addGhunter 失败或全部跳过), 无法判定"); process.exit(2); }
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const minR = Math.min(...ratios);
console.log(`\n汇总(${rows.length} 种子): ratio 各轮 [${ratios.map(v => v.toFixed(3)).join(", ")}] 中位 ${med(ratios).toFixed(3)} 最小 ${minR.toFixed(3)}`);
console.log(`判据 stats.ghunterStallFrames >= attacks×${GH_STALL_FRAMES}×${THRESH}: ${minR >= THRESH ? "PASS" : "FAIL"} (按最小值判)`);
const speedRatioMed = med(rows.map(r => r.speedRatio));
const turnRatioMed = med(rows.map(r => r.turnRatio));
const climbTotal = rows.reduce((s, r) => s + r.stallClimbFrames, 0);
const vzUpTotal = rows.reduce((s, r) => s + r.stallVzUpFrames, 0);
const stallSamples = rows.reduce((s, r) => s + r.stallFrameSamples, 0);
console.log(`效果核对(运行时): 速度比中位 ${speedRatioMed.toFixed(3)}(期望≈0.85) | P95 速度比中位 ${med(rows.map(r => r.speedRatioP95)).toFixed(3)} | `
  + `失速转艏上限(解析) ${rows[0].capDeg.toFixed(3)}°/帧; 失速段超限帧: 互攻击退 ${rows.reduce((s, r) => s + r.stallOverClash, 0)} / 其他 ${rows.reduce((s, r) => s + r.stallOverOther, 0)}(其中处于世界厌恶带内 ${rows.reduce((s, r) => s + r.stallOverOtherBand, 0)}) / `
  + `非失速帧超过该上限的帧数 ${rows.reduce((s, r) => s + r.freeOverCap, 0)}(>0 说明上限确实只在失速段收紧)`);
const ex = rows.map(r => r.stallOverExamples).filter(Boolean).join(" ");
if (ex) console.log(`  失速超限样例(非互攻): ${ex}`);
console.log(`  失速段 z 上升帧 ${climbTotal}/${stallSamples}, 其中主动加升速(vz 变大)帧 ${vzUpTotal}(期望 0)`);
console.log(`三条结算路径合计(运行时): 命中 ${rows.reduce((s, r) => s + r.hits, 0)} / 落空日志 ${rows.reduce((s, r) => s + r.missLogged, 0)} / 打断日志 ${rows.reduce((s, r) => s + r.abortLogged, 0)}; `
  + `stats.ghunterMiss 合计 ${rows.reduce((s, r) => s + r.miss, 0)}(落空+打断), 我按 attack/dashT 归类: 落空 ${rows.reduce((s, r) => s + r.missPath, 0)} / 打断 ${rows.reduce((s, r) => s + r.abortPath, 0)}`);

/* ---------------- 源码指认(交付要求②③) ---------------- */
console.log("\n=== ② 三条结算路径每条都设 stall(源码行号) ===");
console.log(`  命中路径 ghunterResolve(定义):\n${show(/^function ghunterResolve/)}`);
console.log(`    -> 设 stall 的行:\n${show(/g\.stall = GH_STALL_FRAMES;\s*\/\/ W5 失速段开始/)}`);
console.log(`  被打断路径 ghunterAbort(定义):\n${show(/^function ghunterAbort/)}`);
console.log(`    -> 设 stall 的行:\n${show(/g\.stall = GH_STALL_FRAMES;\s*\/\/ W5 被打断/)}`);
console.log(`  落空路径(攻击窗口自然走完):\n${show(/g\.attack = 0; g\.cool = GH_COOLDOWN; g\.stall = GH_STALL_FRAMES; stats\.ghunterMiss\+\+/)}`);
console.log(`  失速计时/计数行:\n${show(/if \(g\.stall > 0\) \{ g\.stall--; stats\.ghunterStallFrames\+\+; \}/)}`);
console.log(`  外部打断触发点(attack=1 且 dashT 被清零):\n${show(/if \(g\.attack === 1 && g\.dashT === 0\) ghunterAbort/)}`);
console.log("\n=== ③ 失速段四效果(常量 + 判定行号) ===");
console.log(`  常量:\n${show(/^const GH_STALL_(FRAMES|TURN|SPEED|CLASH_PEN)/)}`);
console.log(`  ① 转艏×GH_STALL_TURN:\n${show(/turnCap = \(g\.stall > 0 \? GH_MAX_TURN \* GH_STALL_TURN/)}`);
console.log(`  ② 禁爬升(爬升限幅被置 0):\n${show(/g\.stall > 0 \? 0 : GH_CLIMB_RATE/)}`);
console.log(`  ③ 速度×GH_STALL_SPEED:\n${show(/g\.stall > 0 \? GH_STALL_SPEED : 1/)}`);
console.log(`  ④ 互攻 −2:\n${show(/A\.kind === "ghunter" && A\.stall > 0 \? GH_STALL_CLASH_PEN/)}\n${show(/B\.kind === "ghunter" && B\.stall > 0 \? GH_STALL_CLASH_PEN/)}`);
